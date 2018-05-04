{
    "Google Cloud SDK": {
    },
    "datalab": {
	"20180105": [
	    "Instances fail to mount their notebooks disk on first boot. The root cause is a race condition first reported here: https://github.com/googledatalab/datalab/issues/1898. The issue is fixed in versions 20180119 and later. As a workaround, failing instances will correctly mount their notebooks disk after being reset."
	],
	"20180213": [
	    "GPU instances fail to install the NVIDIA driver, preventing them from starting. The root cause was pinning to an older version of the driver that is no longer supported by Container Optimized OS. The issue is fixed in versions 20180503 or later. Alternatively, you can run the tool from the open source repository here: https://github.com/googledatalab/datalab/tree/master/tools/cli"
	],
	"20180412": [
	    "GPU instances fail to install the NVIDIA driver, preventing them from starting. The root cause was pinning to an older version of the driver that is no longer supported by Container Optimized OS. The issue is fixed in versions 20180503 or later. Alternatively, you can run the tool from the open source repository here: https://github.com/googledatalab/datalab/tree/master/tools/cli"
	]
    }
}
