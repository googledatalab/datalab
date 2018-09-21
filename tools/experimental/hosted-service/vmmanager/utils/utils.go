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

// Package utils defines utilities for the VM manager.
package utils

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"golang.org/x/net/context"
	"golang.org/x/oauth2/google"
	compute "google.golang.org/api/compute/v1"
)

const EmailScope = "https://www.googleapis.com/auth/userinfo.email"

// GetGoogleHTTPClient gets an HTTP client that is authenticated with Google OAuth credentials.
//
// This first attempts to use the credentials of the signed-in `gcloud` user, and then
// falls back to using the application default credentials if that fails.
func GetGoogleHTTPClient(ctx context.Context) (*http.Client, error) {
	sdkConfig, err := google.NewSDKConfig("")
	if err == nil {
		return sdkConfig.Client(ctx), nil
	}

	return google.DefaultClient(ctx, compute.CloudPlatformScope, EmailScope)
}

func getOperationErrors(op *compute.Operation) error {
	if op.Error == nil || len(op.Error.Errors) == 0 {
		return nil
	}

	var errorMsgs []string
	for _, e := range op.Error.Errors {
		errorMsgs = append(errorMsgs, fmt.Sprintf("%s: %q", e.Code, e.Message))
	}
	return fmt.Errorf("Operation failed. Messages:\n%s", strings.Join(errorMsgs, "\n"))
}

func WaitForZoneOperation(svc *compute.Service, project, zone, operationName string, sleepDuration time.Duration) error {
	for {
		getCall := svc.ZoneOperations.Get(project, zone, operationName)
		op, err := getCall.Do()
		if err != nil {
			return err
		}
		if op.Status == "DONE" {
			return getOperationErrors(op)
		}
		time.Sleep(sleepDuration)
	}
}

func CreateVM(svc *compute.Service, project, zone, instanceName, description, machineType, network, serviceAccount string, bootDiskSizeGB int64, metadata map[string]*string, pollingInterval time.Duration) error {
	metadataItems := []*compute.MetadataItems{}
	for k, v := range metadata {
		metadataItems = append(metadataItems, &compute.MetadataItems{
			Key:   k,
			Value: v,
		})
	}
	instance := &compute.Instance{
		Description: description,
		Name:        instanceName,
		MachineType: "zones/" + zone + "/machineTypes/" + machineType,
		Disks: []*compute.AttachedDisk{
			&compute.AttachedDisk{
				AutoDelete: true,
				Boot:       true,
				Mode:       "READ_WRITE",
				InitializeParams: &compute.AttachedDiskInitializeParams{
					DiskSizeGb:  bootDiskSizeGB,
					SourceImage: "https://www.googleapis.com/compute/v1/projects/cos-cloud/global/images/family/cos-stable",
				},
			},
		},
		Metadata: &compute.Metadata{
			Items: metadataItems,
		},
		NetworkInterfaces: []*compute.NetworkInterface{
			&compute.NetworkInterface{
				AccessConfigs: []*compute.AccessConfig{
					&compute.AccessConfig{
						Name: "external-nat",
						Type: "ONE_TO_ONE_NAT",
					},
				},
				Network: "global/networks/" + network,
			},
		},
	}
	if serviceAccount != "" {
		instance.ServiceAccounts = []*compute.ServiceAccount{
			&compute.ServiceAccount{
				Email:  serviceAccount,
				Scopes: []string{compute.CloudPlatformScope, EmailScope},
			},
		}
	}
	instanceOp, err := svc.Instances.Insert(project, zone, instance).Do()
	if err != nil {
		return err
	}
	return WaitForZoneOperation(svc, project, zone, instanceOp.Name, pollingInterval)
}

func GetMetadataEntry(vm *compute.Instance, key string) (string, error) {
	for _, item := range vm.Metadata.Items {
		if item.Key == key {
			return *item.Value, nil
		}
	}
	return "", fmt.Errorf("No metadata entry for %q", key)
}
