package com.google.cloud.ijava.communication;

/**
 * This class is designed to have some utility methods and types for displaying rich data in IJava.
 */
public class _ {

  private static IDisplayDataPublisher displayDataPublisher;

  static void setDisplayDataPublisher(IDisplayDataPublisher displayDataPublisher) {
    _.displayDataPublisher = displayDataPublisher;
  }

  static IDisplayDataPublisher getDisplayDataPublisher() {
    return displayDataPublisher;
  }

  public static class HTML {
    private final String html;

    public HTML(String html) {
      this.html = html;
    }

    @Override
    public String toString() {
      return html;
    }
  }

  public static void show(Object o) {
    try {
      if (o == null) {
        displayDataPublisher.publish("text/plain", "null");
        return;
      }
      if (o instanceof HTML) {
        displayDataPublisher.publish("text/html", o.toString());
      } else {
        displayDataPublisher.publish("text/plain", o.toString());
      }
    } catch (CommunicationException e) {
      e.printStackTrace();
    }
  }

  public static void showHTML(String html) {
    try {
      displayDataPublisher.publish("text/html", new HTML(html).toString());
    } catch (CommunicationException e) {
      e.printStackTrace();
    }
  }
}
