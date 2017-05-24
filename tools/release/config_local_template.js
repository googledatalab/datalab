const vid = document.body.getAttribute("data-version-id");
const GTM_ACCOUNT = {{GTM_ACCOUNT_PLACEHOLDER}};
const LATEST_SEMVER = {{DATALAB_VERSION_PLACEHOLDER}};
const latest = vid.split('.')[2] < "20170523" ? {{DATALAB_VERSION_PATCH_PLACEHOLDER}} : LATEST_SEMVER;
if (latest) {
  const LAST_SEMVER = "0.5.20160802";
  const PREV_SEMVER = {{PREV_SEMVER_PLACEHOLDER}};

  window.datalab.versions = {
    latest:   latest,
    last:     LAST_SEMVER,
    previous: PREV_SEMVER,
  };
}

window.datalab.gtmAccount = GTM_ACCOUNT;
window.dataLayer = window.dataLayer || [];
window.dataLayer.push({
	hostname:"datalab.cloud.google.com",
	pagePath:"/notebook/"
});
