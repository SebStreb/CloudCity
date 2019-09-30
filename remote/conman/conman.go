package main

// Ye who reads, beware
// Painful code and terrible, 20h hackathon-tier code incoming

import (
	"bytes"
	"context"
	"docker.io/go-docker"
	"docker.io/go-docker/api/types"
	dockon "docker.io/go-docker/api/types/container"
	"docker.io/go-docker/api/types/network"
	"encoding/json"
	"fmt"
	"github.com/docker/go-connections/nat"
	"github.com/mackerelio/go-osstat/cpu"
	"github.com/mackerelio/go-osstat/memory"
	"io/ioutil"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

const API_URL = "http://192.168.5.19:3000"

var (
	currentMachineState MachineState
	cl                  *docker.Client
	MACHINE_ID          int
)

type MachineState struct {
	Status     *string    `json:"status,omitempty"`
	Resources  *Resources `json:"resources,omitempty"`
	Containers []string   `json:"containers"`
}

type Resources struct {
	Cores  *int64 `json:"cores,omitempty"`
	Memory *int64 `json:"memory,omitempty"`
}

type ImageResponse struct {
	Stream string `json:"stream"`
}

func main() {
	var err error
	MACHINE_ID, err = strconv.Atoi(os.Args[1])
	cl, err = docker.NewEnvClient()
	if err != nil {
		panic("Docker is not available: " + err.Error())
	}
	fmt.Println("ConMan started")
	beat()
	time.Sleep(500 * time.Millisecond)
	startBeating()
}

func startBeating() {
	for range time.Tick(1 * time.Second) {
		fmt.Println("Beating-get stats")
		m, err := http.Get(API_URL + "/machine/" + strconv.Itoa(MACHINE_ID))
		if err != nil {
			panic(err)
		}
		if m.StatusCode != http.StatusOK {
			panic("Failed to beat")
		}
		machineContents, err := ioutil.ReadAll(m.Body)
		if err != nil {
			panic(err)
		}
		var machine MachineState
		err = json.Unmarshal(machineContents, &machine)
		if err != nil {
			panic(err)
		}
		currentMachineState = machine
		if *currentMachineState.Status == "dead" {
			cl.ContainerKill(context.Background(), "cloudcity_nginx", "SIGKILL")
			err := cl.ContainerRemove(context.Background(), "cloudcity_nginx", types.ContainerRemoveOptions{})
			time.Sleep(200 * time.Second)
			fmt.Println(err)
			panic("Server was killed remotely")
		}
		fmt.Println("Beating-heartbeat")
		beat()
		fmt.Println("Beating-container diff")
		con, err := cl.ContainerList(context.Background(), types.ContainerListOptions{})
		if err != nil {
			panic(err)
		}
		activeContainers := map[string]string{}
		var activeContainerID []string
		for _, container := range con {
			fmt.Println(container.Names)
			id := container.Names[0][11:]
			activeContainers[id] = container.ID
			activeContainerID = append(activeContainerID, id)
		}
		for _, container := range currentMachineState.Containers {
			if !contains(activeContainerID, container) {
				fmt.Println("Container ", container, " not found amongst", activeContainerID)
				f, err := os.Open("./1.tar")
				if err != nil {
					panic("could not load container image")
				}
				ilr, err := cl.ImageLoad(context.Background(), f, true)
				if err != nil {
					panic("could not push image")
				}
				time.Sleep(10 * time.Millisecond)
				content, err := ioutil.ReadAll(ilr.Body)
				if err != nil {
					panic("could not load image")
				}
				sContent := strings.Split(string(content), "\n")
				fmt.Println(sContent[0])
				var ir ImageResponse
				json.Unmarshal([]byte(sContent[0]), &ir)
				ilr.Body.Close()
				fmt.Println(ir.Stream)
				imageName := ir.Stream[14 : len(ir.Stream)-1]
				var containerconfig dockon.ContainerCreateCreatedBody
				if container == "apache" {
					n, err := nat.NewPort("tcp", "80")
					if err != nil {
						panic(err)
					}
					containerconfig, err = cl.ContainerCreate(context.Background(), &dockon.Config{
						Image: imageName,
					}, &dockon.HostConfig{
						PortBindings: nat.PortMap{
							n: []nat.PortBinding{
								nat.PortBinding{
									HostIP:   "0.0.0.0",
									HostPort: "80",
								},
							},
						},
					}, &network.NetworkingConfig{}, "cloudcity_"+container)
				} else {
					containerconfig, err = cl.ContainerCreate(context.Background(), &dockon.Config{
						Image: imageName,
					}, &dockon.HostConfig{}, &network.NetworkingConfig{}, "cloudcity_"+container)
				}

				if err != nil {
					panic(err)
				}
				err = cl.ContainerStart(context.Background(), containerconfig.ID, types.ContainerStartOptions{})
				if err != nil {
					panic(err)
				}
			}
		}
		for _, container := range activeContainerID {
			if !contains(currentMachineState.Containers, container) {
				cl.ContainerKill(context.Background(), "cloudcity_"+container, "SIGKILL")
				err := cl.ContainerRemove(context.Background(), "cloudcity_"+container, types.ContainerRemoveOptions{})
				if err != nil {
					panic(err)
				}
			}
		}
	}
}

func contains(s []string, e string) bool {
	for _, a := range s {
		if a == e {
			return true
		}
	}
	return false
}

func beat() {
	cores, mem, err := getMachineStats()
	if err != nil {
		panic(err)
	}
	fmt.Println(MACHINE_ID)
	beatBody, err := json.Marshal(map[string]interface{}{
		"machine": MACHINE_ID,
		"resources": map[string]uint64{
			"cores":  cores,
			"memory": mem,
		},
	})
	resp, err := http.Post(API_URL+"/beat", "application/json", bytes.NewReader(beatBody))
	if err != nil {
		panic(err)
	}
	if resp.StatusCode != http.StatusOK {
		panic("Failed to beat, has the machine been registered yet?")
	}

}

func getMachineStats() (uint64, uint64, error) {
	m, err := memory.Get()
	if err != nil {
		return 0, 0, err
	}
	c, err := cpu.Get()
	if err != nil {
		return 0, 0, err
	}
	return m.Total, uint64(c.CPUCount), nil
}

