// CloudExtension.java
//

package com.google.cloud.datalab;

import java.io.*;
import java.util.*;
import com.google.api.client.auth.oauth2.*;
import com.google.api.client.googleapis.compute.*;
import com.google.api.client.http.*;
import com.google.api.client.http.javanet.*;
import com.google.api.client.json.*;
import com.google.api.client.json.jackson.*;
import com.google.api.services.bigquery.*;

public final class Cloud {

  private final static String CLIENT_APPLICATION = "Google Cloud DataLab";

  private final static String METADATA_HOST_VAR = "METADATA_HOST";
  private final static String METADATA_PORT_VAR = "METADATA_PORT";

  private final static String DEFAULT_METADATA_HOST = "metdata.google.internal";
  private final static String DEFAULT_METADATA_PORT = "80";

  private final static String METADATA_PROJECTID_URL =
      "http://%s/computeMetadata/v1/project/project-id";
  private final static String METADATA_TOKEN_URL =
      "http://%s/computeMetadata/v1/instance/service-accounts/default/token";

  private static final Cloud Instance;

  private final HttpTransport _httpTransport;
  private final JsonFactory _jsonFactory;
  private final Credential _credential;
  private final String _projectId;

  private Bigquery _bigQuery;

  static {
    Cloud cloud = null;
    try {
      cloud = new Cloud();
    }
    catch (IOException e) {
    }

    Instance = cloud;
  }

  private Cloud() throws IOException {
    Map<String, String> environment = System.getenv();
    String metadataHost = environment.get(Cloud.METADATA_HOST_VAR);
    String metadataPort = environment.get(Cloud.METADATA_PORT_VAR);

    if ((metadataHost == null) || metadataHost.isEmpty()) {
      metadataHost = Cloud.DEFAULT_METADATA_HOST;
    }
    if ((metadataPort == null) || metadataPort.isEmpty()) {
      metadataHost = Cloud.DEFAULT_METADATA_PORT;
    }

    String metadataDomain = metadataHost + ":" + metadataPort;

    _httpTransport = new NetHttpTransport();
    _jsonFactory = new JacksonFactory();
    _credential = Cloud.createCredential(metadataDomain, _httpTransport, _jsonFactory);
    _projectId = Cloud.loadProjectId(metadataDomain, _httpTransport, _jsonFactory);

    System.out.println("Current project id: " + _projectId);
  }

  private static Credential createCredential(String metadataDomain,
                                             HttpTransport httpTransport, JsonFactory jsonFactory) {
    ComputeCredential.Builder builder = new ComputeCredential.Builder(httpTransport, jsonFactory);
    Map<String, String> environment = System.getenv();
    if (environment.containsKey(Cloud.METADATA_HOST_VAR) &&
        environment.containsKey(Cloud.METADATA_PORT_VAR)) {

      builder.setTokenServerEncodedUrl(String.format(Cloud.METADATA_TOKEN_URL, metadataDomain));
    }

    return builder.build();
  }

  private static String loadProjectId(String metadataDomain,
                                      HttpTransport httpTransport, JsonFactory jsonFactory)
                                          throws IOException {
    GenericUrl url = new GenericUrl(String.format(Cloud.METADATA_PROJECTID_URL, metadataDomain));

    HttpRequest request = httpTransport.createRequestFactory(new HttpRequestInitializer() {
      @Override
      public void initialize(HttpRequest request) throws IOException {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Google-Metadata-Request", "True");

        request.setHeaders(headers);
      }
    }).buildGetRequest(url);
    HttpResponse response = request.execute();

    return response.parseAsString();
  }

  public static Cloud get() {
    return Cloud.Instance;
  }

  public Bigquery bigQuery() {
    if (_bigQuery == null) {
      Bigquery.Builder builder = new Bigquery.Builder(_httpTransport, _jsonFactory, _credential);
      _bigQuery = builder.setApplicationName(Cloud.CLIENT_APPLICATION)
          .setHttpRequestInitializer(_credential)
          .build();
    }

    return _bigQuery;
  }

  public String projectId() {
    return _projectId;
  }
}
