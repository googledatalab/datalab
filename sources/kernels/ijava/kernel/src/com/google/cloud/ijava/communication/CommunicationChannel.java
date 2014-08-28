package com.google.cloud.ijava.communication;

/**
 * An interface between IJava kernel and underlying transport layer for sending and receiving data.
 */
public interface CommunicationChannel {

  /**
   * @return the message received, as a String object; null on no message.
   */
  public String recvStr() throws CommunicationException;

  /**
   * Sends the data over socket.
   *
   * @return true if the send was successful, false otherwise.
   */
  public boolean send(String data) throws CommunicationException;


  /**
   * Sends the data over socket and indicates that more message parts are coming.
   *
   * @return true if the send was successful, false otherwise.
   */
  public boolean sendMore(String data) throws CommunicationException;

  /**
   * Closes the communication channel.
   */
  public void close() throws CommunicationException;
}
