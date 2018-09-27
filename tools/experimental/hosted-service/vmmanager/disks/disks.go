/*
Copyright 2017 Google Inc. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// Package disks defines the logic for managing a set of per-user persistent disks.
package disks

import (
	"crypto/sha256"
	"encoding/base32"
	"fmt"
	"log"
	"strings"
	"time"

	"golang.org/x/net/context"
	compute "google.golang.org/api/compute/v1"

	"vm-manager/utils"
)

const (
	pollingInterval     = 10 * time.Millisecond
	diskStatusCreating  = "CREATING"
	diskStatusRestoring = "RESTORING"
	diskStatusReady     = "READY"
)

// A Manager provides functionality for getting the disk for a user.
//
// The Manager maintains a 1:1 mapping between user's a disks, so that
// any given user never has more than 1 disk assigned to them.
//
// The Manager is also responsible for creating the disk for a user
// when the user does not already have one, and will initialize the
// disk by formatting it and (optinally) running a specified initialization
// script over the disk.
//
// Internall, the Manager uses a snapshot of an already-initialized
// disk in order to speed up the process of disk creation.
type Manager struct {
	svc            *compute.Service
	project        string
	zone           string
	sourceSnapshot string
}

func createSourceSnapshot(ctx context.Context, svc *compute.Service, project, zone, snapshotName, diskInitScript string, sizeGB int64, vmNetwork string) (*compute.Snapshot, error) {
	startupScript := `#!/bin/bash

PERSISTENT_DISK_DEV="/dev/disk/by-id/google-user-pd"

wait_for_disk() {
  echo "Waiting for the persistent disk to be attached"
  while [ ! -e "${PERSISTENT_DISK_DEV}" ]; do
    echo "Still waiting"
    sleep 1
  done
}

MOUNT_DIR="/mnt/disks/user-pd"
MOUNT_CMD="mount -o discard,defaults ${PERSISTENT_DISK_DEV} ${MOUNT_DIR}"

format_disk() {
  echo "Formatting the persistent disk"
  mkfs.ext4 -F \
    -E lazy_itable_init=0,lazy_journal_init=0,discard \
    "${PERSISTENT_DISK_DEV}"
  mkdir -p "${MOUNT_DIR}"
  ${MOUNT_CMD}
}

METADATA_URL="http://metadata.google.internal"
ATTRIBUTES_PATH="computeMetadata/v1/instance/attributes"
INIT_SCRIPT_URL="${METADATA_URL}/${ATTRIBUTES_PATH}/disk-init-script"

run_init_script() {
  init_script="/tmp/init-script.sh"
  curl -X GET -H 'Metadata-Flavor: Google' \
    -o "${init_script}" "${INIT_SCRIPT_URL}"
  if [ -s "${init_script}" ]; then
    cd "${MOUNT_DIR}"
    . "${init_script}"
  fi
}

wait_for_disk
format_disk
run_init_script

# We power off the instance to signal that it is done initializing the disk.
shutdown -P now
`

	pollingInterval := 10 * time.Millisecond

	poolTimeStampString := strings.ToLower(time.Now().Format("20060102-15-04-05-000-MST"))
	diskName := "template-disk-" + poolTimeStampString
	diskAPIPath := "projects/" + project + "/zones/" + zone + "/disks/" + diskName
	diskOp, err := svc.Disks.Insert(project, zone, &compute.Disk{
		Description: "Template disk",
		Name:        diskName,
		SizeGb:      sizeGB,
	}).Do()
	if err != nil {
		return nil, err
	}
	if err := utils.WaitForZoneOperation(svc, project, zone, diskOp.Name, pollingInterval); err != nil {
		return nil, err
	}
	defer svc.Disks.Delete(project, zone, diskName).Do()

	instanceName := "template-vm-" + poolTimeStampString
	instanceDescription := "Template VM"
	metadata := map[string]*string{
		"startup-script":   &startupScript,
		"disk-init-script": &diskInitScript,
	}
	if err := utils.CreateVM(svc, project, zone, instanceName, instanceDescription, "f1-micro", vmNetwork, "", 10, metadata, pollingInterval); err != nil {
		return nil, err
	}
	defer svc.Instances.Delete(project, zone, instanceName).Do()

	attachedDisk := &compute.AttachedDisk{
		AutoDelete: true,
		Boot:       false,
		Mode:       "READ_WRITE",
		DeviceName: "user-pd",
		Source:     diskAPIPath,
	}
	attachOp, err := svc.Instances.AttachDisk(project, zone, instanceName, attachedDisk).Do()
	if err != nil {
		return nil, err
	}
	if err := utils.WaitForZoneOperation(svc, project, zone, attachOp.Name, pollingInterval); err != nil {
		return nil, err
	}

	instanceGet := svc.Instances.Get(project, zone, instanceName)
	for {
		instance, err := instanceGet.Do()
		if err != nil {
			return nil, err
		}
		if instance.Status == "TERMINATED" {
			snapshotOp, err := svc.Disks.CreateSnapshot(project, zone, diskName, &compute.Snapshot{
				Description: "Starting snapshot for user disks",
				Name:        snapshotName,
			}).Do()
			if err != nil {
				return nil, err
			}
			if err := utils.WaitForZoneOperation(svc, project, zone, snapshotOp.Name, pollingInterval); err != nil {
				return nil, err
			}
			return svc.Snapshots.Get(project, snapshotName).Do()
		}
		time.Sleep(pollingInterval)
	}
}

func getOrCreateSnapshot(ctx context.Context, computeService *compute.Service, project, zone, snapshotName, diskInitScript string, sizeGB int64, vmNetwork string) (*compute.Snapshot, error) {
	snapshot, err := computeService.Snapshots.Get(project, snapshotName).Do()
	if err == nil {
		return snapshot, nil
	}

	return createSourceSnapshot(ctx, computeService, project, zone, snapshotName, diskInitScript, sizeGB, vmNetwork)
}

// NewManager creates a new Manager in the given project/zone combination.
//
// The disks created by the Manager will be generated from a disk snapshot,
// so that they do not have to be formatted once attached to a VM.
//
// The name of the disk snapshot is provided by the `snapshotName` argument.
// If that snapshot already exists, then it is simply reused. Otherwise, this
// method will create it and then format/initialize it using a temporary VM.
//
// If non-empty, then the `diskInitScript` value is run on the initial disk used
// to generate the snapshot. This allows callers to perform arbitrary customizations
// that apply to every disk returned by the pool.
//
// The `diskInitScript` runs as root from the top-level directory of the
// formatted disk.
//
// The `vmNetwork` parameter is used to specify the name of the network in which
// the disk-formatting VM will reside. This VM does not need to accept inbound
// connections, so you should provide the most locked-down network you have.
func NewManager(ctx context.Context, computeService *compute.Service, project, zone, snapshotName, diskInitScript string, sizeGB int64, vmNetwork string) (*Manager, error) {
	log.Printf("Creating the source snapshot for user disks in %q/%q", project, zone)
	snapshot, err := getOrCreateSnapshot(ctx, computeService, project, zone, snapshotName, diskInitScript, sizeGB, vmNetwork)
	if err != nil {
		return nil, err
	}

	log.Printf("Finished creating the disk pool in %q/%q", project, zone)
	return &Manager{
		svc:            computeService,
		project:        project,
		zone:           zone,
		sourceSnapshot: snapshot.SelfLink,
	}, nil
}

// GetDiskName returns the name of the persistent disk for the given user.
//
// This does not imply that the specified disk exists, only what the
// name of it must be if it does exist.
//
// In order to make the user email fit the naming restrictions of the
// Google Compute Engine API (while still preventing collisions), we
// take the sha256 hash of the email.
//
// The resulting hash is 256 bits long, but we need to fit it into a
// 64 character string of lower case letters, numbers, and hyphens.
//
// To do that, we encode the hash as base32, which always results in
// exactly 52 alphanumeric characters followed by 4 padding characters
// (=) at the end. We simply truncate the padding and lowercase the
// alphanumeric characters to get 52 characters (out of a total 64
// allowed) for the disk name.
//
// Finally, we add a "user-" prefix and "-disk" suffix to ensure the
// name does not start or end with a number.
//
// Example:
//   User Email: user@example.com
//   Disk Name: user-mj4q529i7cgq071uig7ha3lpn32k4m3v3avths71pgfvoni7aka0-disk
func (d *Manager) GetDiskName(userEmail string) string {
	hash := sha256.Sum256([]byte(userEmail))
	base32Str := base32.HexEncoding.EncodeToString(hash[:])
	resourceNamePart := strings.ToLower(base32Str)[0:52]
	return fmt.Sprintf("user-%s-disk", resourceNamePart)
}

func (d *Manager) createNewDisk(ctx context.Context, diskName string) (*compute.Disk, error) {
	disk := &compute.Disk{
		Name:           diskName,
		Description:    "Allocated disk for a single user",
		SourceSnapshot: d.sourceSnapshot,
	}
	op, err := d.svc.Disks.Insert(d.project, d.zone, disk).Do()
	if err != nil {
		return nil, err
	}
	if err := utils.WaitForZoneOperation(d.svc, d.project, d.zone, op.Name, pollingInterval); err != nil {
		return nil, err
	}
	return d.svc.Disks.Get(d.project, d.zone, diskName).Do()
}

func (d *Manager) waitForDiskFinishedCreating(disk *compute.Disk) (*compute.Disk, error) {
	var err error
	for disk.Status == diskStatusCreating || disk.Status == diskStatusRestoring {
		time.Sleep(pollingInterval)

		disk, err = d.svc.Disks.Get(d.project, d.zone, disk.Name).Do()
		if err != nil {
			return nil, err
		}
	}
	return disk, err
}

// GetForUser gets the persistent disk for the specified user,
// creating it if it does not already exist.
func (d *Manager) GetForUser(ctx context.Context, userEmail string) (*compute.Disk, error) {
	diskName := d.GetDiskName(userEmail)

	log.Printf("Getting the disk %q for the user %q", diskName, userEmail)

	disk, err := d.svc.Disks.Get(d.project, d.zone, diskName).Do()
	if err == nil {
		disk, err = d.waitForDiskFinishedCreating(disk)
		if err != nil {
			return nil, err
		}
		if disk.Status != diskStatusReady {
			return nil, fmt.Errorf("Unexpected disk status: %q", disk.Status)
		}
		return disk, err
	}

	// TODO(ojarjur): We are assuming any errors in the GET API mean
	// the disk does not exist. We should actually check that.
	disk, err = d.createNewDisk(ctx, diskName)

	if err != nil {
		log.Printf("Failed to get the disk %q", diskName)
	}
	return disk, err
}
