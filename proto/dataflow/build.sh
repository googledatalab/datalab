#!/bin/sh

gradle build shadowJar -p sdk
gradle build -p shell

