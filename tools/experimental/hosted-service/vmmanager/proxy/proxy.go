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

// Package proxy defines logic for calling into the admin API of the proxy
package proxy

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"strings"
	"time"

	compute "google.golang.org/api/compute/v1"

	"vm-manager/utils"
)

const (
	backendsPath   = "api/backends"
	apiContentType = "text/plain"
)

// Backend defines an entry in the proxy for server backends.
type Backend struct {
	ID           string    `json:"id,omitempty"`
	EndUser      string    `json:"endUser,omitempty"`
	BackendUser  string    `json:"backendUser,omitempty"`
	PathPrefixes []string  `json:"pathPrefixes,omitempty"`
	LastUsed     time.Time `json:"lastUsed,omitempty"`
}

// reader serializes the definition of the backend and returns it as a Reader.
func (b *Backend) reader() (io.Reader, error) {
	jsonBytes, err := json.Marshal(b)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(jsonBytes), nil
}

// Admin implements the admin API for a proxy.
type Admin struct {
	client *http.Client
	url    string
}

// NewAdmin returns a new Admin implementation.
//
// `client` defines an HTTP client that can be used to issue API calls
// to the proxy, and `url` is the address of the proxy API.
//
// The provided client should already be authenticated (e.g.
// already have OAuth credentials attached) prior to being
// passed to this method.
func NewAdmin(client *http.Client, url string) *Admin {
	return &Admin{
		client: client,
		url:    url,
	}
}

func (a *Admin) backendsURL() string {
	if strings.HasSuffix(a.url, "/") {
		return a.url + backendsPath
	}
	return a.url + "/" + backendsPath
}

// RegisterBackend registers that the given VM should act as a sever
// backend for the specified user.
func (a *Admin) RegisterBackend(vm *compute.Instance, user string) error {
	backendID, err := utils.GetMetadataEntry(vm, "backend-id")
	if err != nil {
		return err
	}
	serviceAccount := vm.ServiceAccounts[0].Email
	backend := &Backend{
		ID:           backendID,
		EndUser:      user,
		BackendUser:  serviceAccount,
		PathPrefixes: []string{"/"},
	}
	log.Printf("Sending proxy admin request:\n%q\n", backend)

	backendReader, err := backend.reader()
	if err != nil {
		return err
	}
	adminResp, err := a.client.Post(a.backendsURL(), apiContentType, backendReader)
	if err != nil {
		return err
	}

	log.Printf("Received proxy admin response:\n%q\n", adminResp.Status)
	if adminResp.StatusCode != http.StatusOK {
		return fmt.Errorf("Unexpected status code in proxy admin response: %d [%q]", adminResp.StatusCode, adminResp.Status)
	}
	return nil
}

// IdleBackends returns the list of all backends that have been idle
// for longer than the specified duration.
func (a *Admin) IdleBackends(idleDuration time.Duration) ([]string, error) {
	adminResp, err := a.client.Get(a.backendsURL())
	if err != nil {
		return nil, err
	}

	fullResp, err := ioutil.ReadAll(adminResp.Body)
	if err != nil {
		return nil, err
	}

	var allBackends []*Backend
	if err := json.Unmarshal(fullResp, &allBackends); err != nil {
		return nil, err
	}

	var idleBackends []string
	for _, b := range allBackends {
		if b.LastUsed.Unix() > 0 && time.Since(b.LastUsed) > idleDuration {
			idleBackends = append(idleBackends, b.ID)
		}
	}
	return idleBackends, nil
}
