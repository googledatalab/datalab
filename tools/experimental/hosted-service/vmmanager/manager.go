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

// Command manager manages a pool of per-user backends for an inverting proxy.
//
// To build, run:
//
//    $ go build -o ~/bin/vm-manager manager.go
//
// And to use, run:
//
//    $ ~/bin/vm-manager -proxy-api <proxy-api-url> -project <project> -zone <zone>

package main

import (
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"golang.org/x/net/context"
	compute "google.golang.org/api/compute/v1"
	iam "google.golang.org/api/iam/v1"

	"vm-manager/disks"
	"vm-manager/proxy"
	"vm-manager/utils"
	"vm-manager/vms"
)

const (
	HeaderUserID = "X-Inverting-Proxy-User-ID"

	ResponsePage = `<html>
  <head>
    <meta http-equiv="refresh" content="30" />
  </head>
  <body>
    <p>Your instance is being (re)started for you.</p>
    <p>This page will automatically refresh in 30 seconds.</p>
  </body>
</html>
`
)

var (
	proxyProject = flag.String("proxy-project", "", "Google Cloud Platform project hosting the inverting proxy")
	project      = flag.String("project", "", "Google Cloud Platform project to use")
	zone         = flag.String("zone", "", "Zone in which to run backends")
	network      = flag.String("network", "default", "Network in which to run backends")

	sourceSnapshot = flag.String("source-snapshot", "user-disk-template", "Snapshot used to create user disks")
	machineType    = flag.String("machine-type", "n1-standard-1", "Machine type for backends")
	image          = flag.String("image", "", "Application image to run in backends")

	allowedDomain = flag.String("allowed-domain", "", "(Optional) domain of which users must be members")

	port     = flag.Int("port", 8080, "Port on which to start the vm-manager server.")
	diskInit = flag.String("disk-init", "", "Name of a file containing the disk initialization script")
)

func attachDiskToVM(computeService *compute.Service, vm *compute.Instance, disk *compute.Disk) error {
	attachedDisk := &compute.AttachedDisk{
		AutoDelete: false,
		Boot:       false,
		Mode:       "READ_WRITE",
		DeviceName: "user-pd",
		Source:     disk.SelfLink,
	}
	attachOp, err := computeService.Instances.AttachDisk(*project, *zone, vm.Name, attachedDisk).Do()
	if err != nil {
		log.Printf("Failed to attach the disk: %q", err.Error())
		return err
	}
	if err := utils.WaitForZoneOperation(computeService, *project, *zone, attachOp.Name, 10*time.Millisecond); err != nil {
		log.Printf("Failed to attach the disk: %q", err.Error())
		return err
	}
	return nil
}

func getOrCreateVM(ctx context.Context, computeService *compute.Service, diskManager *disks.Manager, vmPool *vms.Pool, user string) (*compute.Instance, error) {
	for i := 0; i < 10; i++ {
		disk, err := diskManager.GetForUser(ctx, user)
		if err != nil {
			return nil, err
		}
		log.Printf("Fetched the disk %q for the user %q\n", disk.Name, user)

		if len(disk.Users) > 0 {
			instancePath := disk.Users[0]
			instanceName := instancePath[strings.LastIndex(instancePath, "/")+1:]
			log.Printf("The disk is already attached to %q\n", instanceName)
			return computeService.Instances.Get(*project, *zone, instanceName).Do()
		}

		vm, err := vmPool.WaitForVM(ctx, user)
		if err != nil {
			return nil, err
		}

		log.Printf("Fetched an empty VM: %q\n", vm.Name)
		if err := attachDiskToVM(computeService, vm, disk); err == nil {
			return vm, nil
		}
		// Note: We do not delete a failed VM at this point, but rather
		// do so in an asynchronous process. This is to make sure that our
		// clean up is done outside of the end-user-request processing.
	}

	return nil, fmt.Errorf("Failed too many times to attach the disk for %q", user)
}

func handleUserRequest(ctx context.Context, computeService *compute.Service, diskManager *disks.Manager, vmPool *vms.Pool, proxyAdmin *proxy.Admin, user string) error {
	vm, err := getOrCreateVM(ctx, computeService, diskManager, vmPool, user)
	if err != nil {
		return err
	}
	return proxyAdmin.RegisterBackend(vm, user)
}

func main() {
	flag.Parse()

	if *proxyProject == "" {
		fmt.Println("You must specify the project hosting the inverting proxy")
		os.Exit(1)
	}

	if *project == "" {
		fmt.Println("You must specify the ID of the GCP project")
		os.Exit(1)
	}

	if *zone == "" {
		fmt.Println("You must specify the GCP zone to use")
		os.Exit(1)
	}

	if *image == "" {
		fmt.Println("You must specify the application image to use")
		os.Exit(1)
	}

	ctx := context.Background()
	c, err := utils.GetGoogleHTTPClient(ctx)
	if err != nil {
		log.Fatal(err)
	}

	proxyAdminURL := fmt.Sprintf("https://api-dot-%s.appspot.com/", *proxyProject)
	proxyURL := fmt.Sprintf("https://agent-dot-%s.appspot.com/", *proxyProject)
	proxiedHostname := fmt.Sprintf("%s.appspot.com", *proxyProject)

	proxyAdmin := proxy.NewAdmin(c, proxyAdminURL)

	computeService, err := compute.New(c)
	if err != nil {
		log.Fatal(err)
	}
	iamService, err := iam.New(c)
	if err != nil {
		log.Fatal(err)
	}

	var diskInitScript string
	if *diskInit != "" {
		diskInitBytes, err := ioutil.ReadFile(*diskInit)
		if err != nil {
			log.Fatal(err)
		}
		diskInitScript = string(diskInitBytes)
	}
	diskManager, err := disks.NewManager(ctx, computeService, *project, *zone, *sourceSnapshot, diskInitScript, 200, *network)
	if err != nil {
		log.Fatal(err)
	}

	vmPool, err := vms.NewPool(ctx, computeService, iamService, proxyAdmin, proxyURL, proxiedHostname, *project, *zone, *network, *machineType, *image)
	if err != nil {
		log.Fatal(err)
	}

	http.HandleFunc("/liveness_check", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})
	http.HandleFunc("/readiness_check", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})
	http.HandleFunc("/_ah/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		requestCtx, cancelFn := context.WithCancel(ctx)
		defer cancelFn()

		user := r.Header.Get(HeaderUserID)
		if user == "" {
			log.Printf("Unable to get user ID for the request")
			http.NotFound(w, r)
			return
		}

		if !strings.HasSuffix(user, *allowedDomain) {
			log.Printf("User %q not allowed: not part of the domain %q", user, *allowedDomain)
			http.NotFound(w, r)
			return
		}

		if err := handleUserRequest(requestCtx, computeService, diskManager, vmPool, proxyAdmin, user); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Add("Cache-Control", "no-cache")
		w.Write([]byte(ResponsePage))
		return
	})

	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%d", *port), nil))
}
