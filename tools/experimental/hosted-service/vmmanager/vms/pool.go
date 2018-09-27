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

// Package vms defines logic for managing a pool of virtual machines.
package vms

import (
	"bytes"
	"crypto/rand"
	"errors"
	"fmt"
	"log"
	"math"
	"math/big"
	"sort"
	"text/template"
	"time"

	"github.com/golang/groupcache/lru"
	"golang.org/x/net/context"
	compute "google.golang.org/api/compute/v1"
	iam "google.golang.org/api/iam/v1"

	"vm-manager/proxy"
	"vm-manager/utils"
)

const (
	pollingInterval            = 10 * time.Millisecond
	vmWaitTimeout              = 30 * time.Second
	assignmentTimeLimit        = 12 * time.Hour
	partialAssignmentTimeLimit = 1 * time.Minute
	idleDuration               = 90 * time.Minute
	creationTimeLimit          = 3 * 24 * time.Hour

	targetFreeVMCount = 10

	vmCacheLimit = 1000
	vmChanSize   = 1000

	assignAttemptLimit  = 10
	backendIDKey        = "backend-id"
	forUserKey          = "for-user"
	forUserTimestampKey = "for-user-timestamp"
)

var cloudConfigTmplText = `#cloud-config
users:
- name: backend
  uid: 2000
  groups: docker
- name: agent
  uid: 2001
  groups: docker

write_files:
- path: /etc/systemd/system/waitfordiskready.sh
  permissions: 0744
  owner: root
  content: |
    PERSISTENT_DISK_DEV="/dev/disk/by-id/google-user-pd"
    MOUNT_DIR="/mnt/disks/user-pd"
    MOUNT_CMD="mount -o discard,defaults ${PERSISTENT_DISK_DEV} ${MOUNT_DIR}"

    wait_for_disk() {
      echo "Waiting for the persistent disk to be attached"
      while [ ! -e "${PERSISTENT_DISK_DEV}" ]; do
        sleep 1
      done
      echo "The persistent disk has been attached"
    }

    mount_disk() {
      if mount | grep "${MOUNT_DIR}" > /dev/null; then
        echo "The persistent disk has already been mounted"
      else
        echo "Mounting the persistent disk"
        mkdir -p "${MOUNT_DIR}"
        ${MOUNT_CMD}
      fi
    }
    wait_for_disk
    mount_disk

- path: /etc/systemd/system/pullimages.sh
  permissions: 0744
  owner: root
  content: |
    docker pull gcr.io/inverting-proxy/agent
    docker pull {{.ApplicationImage}}

- path: /etc/systemd/system/waitfordisk.service
  permissions: 0644
  owner: root
  content: |
    [Unit]
    Description=wait for disk
    Requires=network-online.target
    After=network-online.target setup.service

    [Service]
    Type=oneshot
    ExecStart=/bin/bash /etc/systemd/system/waitfordiskready.sh

- path: /etc/systemd/system/pullimages.service
  permissions: 0644
  owner: root
  content: |
    [Unit]
    Description=pull docker images
    Requires=network-online.target
    After=network-online.target setup.service

    [Service]
    Type=oneshot
    ExecStart=/bin/bash /etc/systemd/system/pullimages.sh

- path: /etc/systemd/system/backend.service
  permissions: 0644
  owner: root
  content: |
    [Unit]
    Description=backend docker container
    Requires=network-online.target waitfordisk.service
    After=network-online.target waitfordisk.service
    [Service]
    ExecStartPre=-/usr/bin/docker rm -fv backend
    ExecStart=/usr/bin/docker run --rm \
        --name=backend \
        -p 127.0.0.1:8080:8080 \
        -v /mnt/disks/user-pd:/content \
        --hostname "{{.ProxiedHostname}}" \
        --env=CLOUD_SDK_CORE_PROJECT="" \
        --env=NO_GCE_CHECK="True" \
        {{.ApplicationImage}}
    Restart=always
    RestartSec=1

- path: /etc/systemd/system/agent.service
  permissions: 0644
  owner: root
  content: |
    [Unit]
    Description=proxy agent docker container
    Requires=network-online.target waitfordisk.service
    After=network-online.target waitfordisk.service

    [Service]
    Environment="HOME=/home/agent"
    ExecStartPre=-/usr/bin/docker rm -fv agent
    ExecStart=/usr/bin/docker -D run --net=host -t --rm -u 0 \
       --name=agent \
       --env="BACKEND={{.BackendID}}" \
       --env="PROXY={{.ProxyURL}}" \
       gcr.io/inverting-proxy/agent
    Restart=always
    RestartSec=1

runcmd:
- systemctl daemon-reload
- systemctl start pullimages.service
- systemctl start waitfordisk.service
- systemctl start backend.service
- systemctl start agent.service
`

type byTimestamp []*compute.Instance

func (t byTimestamp) Len() int           { return len(t) }
func (t byTimestamp) Swap(i, j int)      { t[i], t[j] = t[j], t[i] }
func (t byTimestamp) Less(i, j int) bool { return t[i].CreationTimestamp < t[j].CreationTimestamp }

// A Config holds the creation-time parameters for a per-user VM.
type Config struct {
	InstanceName       string
	ServiceAccountName string
	ProxyURL           string
	ApplicationImage   string
	BackendID          string
	ProxiedHostname    string
}

func (c *Config) getCloudConfig() (string, error) {
	t := template.Must(template.New(cloudConfigTmplText).Parse(cloudConfigTmplText))

	var b bytes.Buffer
	if err := t.Execute(&b, c); err != nil {
		return "", err
	}
	return b.String(), nil
}

func (c *Config) getMetadata() (map[string]*string, error) {
	cloudConfig, err := c.getCloudConfig()
	if err != nil {
		return nil, err
	}
	emptyForUser := ""
	metadata := map[string]*string{
		"user-data":  &cloudConfig,
		backendIDKey: &c.BackendID,
		forUserKey:   &emptyForUser,
	}
	return metadata, nil
}

// A Pool is a collection of unallocated virtual machines.
type Pool struct {
	computeSvc *compute.Service
	iamSvc     *iam.Service
	proxyAdmin *proxy.Admin

	proxyURL         string
	proxiedHostname  string
	project          string
	zone             string
	network          string
	machineType      string
	applicationImage string

	freeVMChan chan *compute.Instance
}

func isIdle(vm *compute.Instance, idleBackends map[string]struct{}) bool {
	backendID, err := utils.GetMetadataEntry(vm, backendIDKey)
	if err != nil {
		// This is not a backend VM, so it cannot be an idle backend
		return false
	}
	if _, ok := idleBackends[backendID]; ok {
		return true
	}
	return false
}

func isUnassigned(vm *compute.Instance) bool {
	forUser, err := utils.GetMetadataEntry(vm, forUserKey)
	if err != nil {
		// This means VM was not created to be part of the pool
		return false
	}
	return len(vm.Disks) == 1 && forUser == ""
}

func assignedForTooLong(vm *compute.Instance) bool {
	forUserTimestamp, err := utils.GetMetadataEntry(vm, forUserTimestampKey)
	if err != nil {
		// This VM has never been assigned
		return false
	}
	assignmentTime, err := time.Parse(time.RFC3339, forUserTimestamp)
	if err != nil {
		log.Printf("Malformed timestamp metadata: %q[%q]", forUserTimestamp, err.Error())
		return false
	}
	// We have two separate deadlines for assignment:
	//
	//  1. The max amount of time a VM can be assigned without a user disk
	//  2. The max amount of time a VM can be assigned with a user disk
	//
	// The first is used to cleanup VMs that where the user assignment
	// failed (usually due to the user's disk being attached to a different
	// VM), while the second is used to ensure that successfully assigned
	// VMs get reclaimed periodically.

	if len(vm.Disks) > 1 {
		// The VM was fully assigned
		return time.Since(assignmentTime) > assignmentTimeLimit
	} else {
		// The VM was only partially assigned
		return time.Since(assignmentTime) > partialAssignmentTimeLimit
	}
}

func isOutOfDate(vm *compute.Instance) bool {
	if !isUnassigned(vm) {
		// We only use this check for unassigned VMs. Assigned VMs have a
		// different expiration policy.
		return false
	}

	creationTime, err := time.Parse(time.RFC3339, vm.CreationTimestamp)
	if err != nil {
		log.Printf("Malformed creation timestamp: %q[%q]", vm.CreationTimestamp, err.Error())
		return false
	}
	return time.Since(creationTime) > creationTimeLimit
}

// NewPool creates a new VM pool in the given project/zone combination.
//
// The `applicationImage` value specifies the full path of a Docker image that
// will run on the VM once the user's disk has been attached to it.
//
// The user's disk will be volume mounted into the Docker container at `/content`.
func NewPool(ctx context.Context, computeService *compute.Service, iamService *iam.Service, proxyAdmin *proxy.Admin, proxyURL, proxiedHostname, project, zone, network, machineType, applicationImage string) (*Pool, error) {
	log.Printf("Creating the VM pool in %q/%q", project, zone)
	freeVMChan := make(chan *compute.Instance, vmChanSize)
	pool := &Pool{
		computeSvc:       computeService,
		iamSvc:           iamService,
		proxyAdmin:       proxyAdmin,
		proxyURL:         proxyURL,
		proxiedHostname:  proxiedHostname,
		project:          project,
		zone:             zone,
		network:          network,
		machineType:      machineType,
		applicationImage: applicationImage,
		freeVMChan:       freeVMChan,
	}
	pool.Fill(ctx)
	log.Printf("Finished creating the VM pool in %q/%q", project, zone)

	go func() {
		previouslySeenVMs := lru.New(vmCacheLimit)
		ticker := time.NewTicker(pollingInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				vms, err := pool.Fill(ctx)
				if err != nil {
					log.Printf("Error filling the free VM pool: %q", err.Error())
				} else {
					for _, vm := range vms {
						if _, ok := previouslySeenVMs.Get(vm.Id); !ok {
							previouslySeenVMs.Add(vm.Id, vm.Id)
							freeVMChan <- vm
						}
					}
				}
				idleBackends, err := pool.proxyAdmin.IdleBackends(idleDuration)
				if err != nil {
					log.Printf("Error looking up the idle backendss: %q", err.Error())
					idleBackends = []string{}
				}
				if err := pool.KillOldVMs(idleBackends); err != nil {
					log.Printf("Error killing the old VMs: %q", err.Error())
				}
			}
		}
	}()
	return pool, nil
}

// FreeVMs returns the list of unallocated VMs in the pool
func (p *Pool) FreeVMs() ([]*compute.Instance, error) {
	vms, err := p.computeSvc.Instances.List(p.project, p.zone).Do()
	if err != nil {
		return nil, err
	}
	var pooledVMs []*compute.Instance
	for _, vm := range vms.Items {
		if isUnassigned(vm) {
			pooledVMs = append(pooledVMs, vm)
		}
	}
	sort.Sort(byTimestamp(pooledVMs))
	return pooledVMs, nil
}

// Fill ensures that the pool contains the target number of free VMs.
func (p *Pool) Fill(ctx context.Context) ([]*compute.Instance, error) {
	vms, err := p.FreeVMs()
	if err != nil {
		return nil, err
	}
	for i := len(vms); i < targetFreeVMCount; i++ {
		vm, err := p.createVM(ctx)
		if err != nil {
			return nil, err
		}
		if err := p.proxyAdmin.RegisterBackend(vm, ""); err != nil {
			return nil, err
		}
		vms = append(vms, vm)
	}
	return vms, nil
}

// TooOldVMs computes the list of all VMs that are too old under three criteria:
//
//   1. Having sat idle for too long (i.e. wasting money).
//   2. Having been assigned to a user for too long (as a form of abuse prevention).
//   3. Being unassigned and created too long ago (i.e. potentially running an out-of-date image).
func (p *Pool) TooOldVMs(vms []*compute.Instance, idleBackends []string) ([]*compute.Instance, error) {
	idleBackendMap := make(map[string]struct{})
	for _, idleBackend := range idleBackends {
		idleBackendMap[idleBackend] = struct{}{}
	}

	var tooOldVMs []*compute.Instance
	for _, vm := range vms {
		if isIdle(vm, idleBackendMap) || assignedForTooLong(vm) || isOutOfDate(vm) {
			tooOldVMs = append(tooOldVMs, vm)
		}
	}
	return tooOldVMs, nil
}

func (p *Pool) DeleteVM(vm *compute.Instance) error {
	log.Printf("Deleting the VM %s/%s/%s", p.project, p.zone, vm.Name)
	op, err := p.computeSvc.Instances.Delete(p.project, p.zone, vm.Name).Do()
	if err != nil {
		return fmt.Errorf("Failure deleting the instance %q: %q", vm.Name, err.Error())
	}
	if err := utils.WaitForZoneOperation(p.computeSvc, p.project, p.zone, op.Name, pollingInterval); err != nil {
		return fmt.Errorf("Failure waiting for an instance delete operation: %q", err.Error())
	}
	for _, account := range vm.ServiceAccounts {
		fullAccountName := fmt.Sprintf("projects/%s/serviceAccounts/%s", p.project, account.Email)
		log.Printf("Deleting the service account %q", fullAccountName)
		_, err := p.iamSvc.Projects.ServiceAccounts.Delete(fullAccountName).Do()
		if err != nil {
			return fmt.Errorf("Failed to delete the service account %q: %q", fullAccountName, err.Error())
		}
	}
	return nil
}

func (p *Pool) KillOldVMs(idleBackends []string) error {
	vms, err := p.computeSvc.Instances.List(p.project, p.zone).Do()
	if err != nil {
		return fmt.Errorf("Failure listing the VMs: %q", err.Error())
	}
	tooOldVMs, err := p.TooOldVMs(vms.Items, idleBackends)
	if err != nil {
		return fmt.Errorf("Failure identifying the `too-old` VMs: %q", err.Error())
	}
	for _, vm := range tooOldVMs {
		log.Printf("Deleting too-old VM %q", vm.Name)
		if err := p.DeleteVM(vm); err != nil {
			return fmt.Errorf("Failure deleting a `too-old` VMs: %q", err.Error())
		}
	}
	return nil
}

// createConfig randomly generates a new VM configuration.
//
// This does not actually create the VM. That is done by the `createVM` method.
func (pool *Pool) createConfig() (*Config, error) {
	randInt, err := rand.Int(rand.Reader, big.NewInt(math.MaxInt64))
	if err != nil {
		return nil, err
	}
	backendID := randInt.Text(16)
	instanceName := "user-vm-" + backendID
	serviceAccountName := "sa-" + backendID
	return &Config{
		InstanceName:       instanceName,
		ServiceAccountName: serviceAccountName,
		ProxyURL:           pool.proxyURL,
		ApplicationImage:   pool.applicationImage,
		BackendID:          backendID,
		ProxiedHostname:    pool.proxiedHostname,
	}, nil
}

func (pool *Pool) createVM(ctx context.Context) (*compute.Instance, error) {
	config, err := pool.createConfig()
	if err != nil {
		return nil, err
	}
	metadata, err := config.getMetadata()
	if err != nil {
		return nil, err
	}

	instanceDescription := "User VM"
	serviceAccountDescription := fmt.Sprintf("Service account for the VM %q", config.InstanceName)

	log.Printf("Creating the service account %s", config.ServiceAccountName)
	serviceAccount, err := pool.iamSvc.Projects.ServiceAccounts.Create(
		"projects/"+pool.project,
		&iam.CreateServiceAccountRequest{
			AccountId: config.ServiceAccountName,
			ServiceAccount: &iam.ServiceAccount{
				DisplayName: serviceAccountDescription,
			},
		}).Do()
	if err != nil {
		return nil, err
	}

	log.Printf("Creating the VM %s/%s/%s", pool.project, pool.zone, config.InstanceName)
	if err := utils.CreateVM(pool.computeSvc, pool.project, pool.zone,
		config.InstanceName, instanceDescription, pool.machineType, pool.network,
		serviceAccount.Email, 20, metadata, pollingInterval); err != nil {
		return nil, err
	}
	log.Printf("Waiting for the VM %s/%s/%s to start running", pool.project, pool.zone, config.InstanceName)
	instanceGetCall := pool.computeSvc.Instances.Get(pool.project, pool.zone, config.InstanceName)
	for {
		instance, err := instanceGetCall.Do()
		if err != nil {
			pool.DeleteVM(instance)
			return nil, err
		}
		if instance.Status == "RUNNING" {
			return instance, nil
		}
		if instance.Status != "PROVISIONING" && instance.Status != "STAGING" {
			pool.DeleteVM(instance)
			return nil, fmt.Errorf("Unexpected instance status: %q", instance.Status)
		}
		time.Sleep(pollingInterval)
	}
}

func (pool *Pool) assignVM(vm *compute.Instance, userEmail string) error {
	var updatedItems []*compute.MetadataItems
	for _, item := range vm.Metadata.Items {
		if item.Key != forUserKey && item.Key != forUserTimestampKey {
			updatedItems = append(updatedItems, item)
		}
	}
	forUserItem := &compute.MetadataItems{
		Key:   forUserKey,
		Value: &userEmail,
	}
	timestamp := time.Now().Format(time.RFC3339)
	forUserTimestampItem := &compute.MetadataItems{
		Key:   forUserTimestampKey,
		Value: &timestamp,
	}
	updatedItems = append(updatedItems, forUserItem, forUserTimestampItem)
	op, err := pool.computeSvc.Instances.SetMetadata(pool.project, pool.zone, vm.Name, &compute.Metadata{
		Fingerprint: vm.Metadata.Fingerprint,
		Items:       updatedItems,
	}).Do()
	if err != nil {
		return err
	}
	return utils.WaitForZoneOperation(pool.computeSvc, pool.project, pool.zone, op.Name, pollingInterval)
}

func (pool *Pool) WaitForVM(ctx context.Context, userEmail string) (*compute.Instance, error) {
	log.Print("Waiting for a new VM from the pool")

	timer := time.NewTimer(vmWaitTimeout)
	for i := 0; i < assignAttemptLimit; i++ {
		select {
		case vm := <-pool.freeVMChan:
			if err := pool.assignVM(vm, userEmail); err != nil {
				log.Printf("Error assigning a VM: %q, %q", vm.Name, err.Error())
				continue
			}
			return vm, nil
		case <-timer.C:
			return nil, errors.New("Timeout waiting for a free VM")
		}
	}
	return nil, fmt.Errorf("Exceeded VM assignment retry limit: %d", assignAttemptLimit)
}
