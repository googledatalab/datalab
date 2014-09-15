package com.google.cloud.ijava.communication;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Java class representation of a message in IPython protocol. For full information about message
 * format and its content see this <a
 * href="http://ipython.org/ipython-doc/2/development/messaging.html">link</a>. The names of fields
 * have {@code _} in them. That is because it is easier this way to convert these messages into and
 * back from JSON messages.
 */
class Message<T extends Message.Content> {
  T content;

  Header header;

  List<String> identities;

  Map<String, String> metadata;

  Header parent_header;

  Message(List<String> identities, Header header, Header parentHeader, Map<String, String> metadata,
      T content) {
    this.identities = identities;
    this.header = header;
    this.parent_header = parentHeader;
    this.metadata = metadata;
    this.content = content;
  }

  /**
   * Creates and returns a published message of the specified type, with the specified content and
   * metadata.
   */
  <R extends Message.Content.Reply> Message<R> publish(MessageType messageType, R content,
      Map<String, String> metadata) {
    List<String> ids = new ArrayList<>();
    if (content instanceof Stream) {
      ids.add(((Stream) content).name.toString());
    } else {
      ids.add(messageType.toString());
    }
    return replyMessage(ids, messageType, content, metadata);
  }

  <R extends Message.Content.Reply> Message<R> reply(MessageType messageType, R content,
      Map<String, String> metadata) {
    return replyMessage(identities, messageType, content, metadata);
  }

  private Header replyHeader(MessageType messageType) {
    return new Header(UUID.randomUUID(), header.username, header.session, messageType);
  }

  <R extends Message.Content.Reply> Message<R> replyMessage(List<String> identities,
      MessageType messageType, R content, Map<String, String> metadata) {
    return new Message<R>(identities, replyHeader(messageType), header, metadata, content);
  }

  static enum MessageType {
    complete_reply,
    complete_request,
    connect_reply,
    connect_request,
    display_data,
    error,
    execute_input,
    execute_reply,
    execute_request,
    execute_result,
    history_reply,
    history_request,
    input_reply,
    input_request,
    kernel_info_reply,
    kernel_info_request,
    object_info_reply,
    object_info_request,
    shutdown_reply,
    shutdown_request,
    status,
    stream;
  }

  // ========================== Message Contents ==========================

  /**
   * There are two types of content; Reply and Request.
   */
  static abstract class Content {
    static abstract class Reply extends Content {
    }
    static abstract class Request extends Content {
    }
  }

  static class CompleteReply extends Message.Content.Reply {
    String matched_text;
    List<String> matches;
    ExecutionStatus status;
  }

  static class CompleteRequest extends Message.Content.Request {
    String block;
    Integer cursor_pos;
    String line;
    String text;

    CompleteRequest(String block, Integer cursor_pos, String line, String text) {
      this.block = block;
      this.cursor_pos = cursor_pos;
      this.line = line;
      this.text = text;
    }
  }

  static class ConnectReply extends Message.Content.Reply {
    Integer shell_port, iopub_port, stdin_port, hb_port;

    ConnectReply(Integer shell_port, Integer iopub_port, Integer stdin_port, Integer hb_port) {
      this.shell_port = shell_port;
      this.iopub_port = iopub_port;
      this.stdin_port = stdin_port;
      this.hb_port = hb_port;
    }
  }

  static class ConnectRequest extends Message.Content.Request {

  }

  static class DisplayData extends Message.Content.Reply {
    Map<String, Object> data;
    Map<String, String> metadata;
    String source;

    protected DisplayData() {}

    DisplayData(String source, Map<String, Object> data, Map<String, String> metadata) {
      this.source = source;
      this.data = data;
      this.metadata = metadata;
    }
  }

  /**
   * Special class to mark the end of Stream.
   */
  static class EndOfStreamDisplayData extends DisplayData {

  }

  static class Error extends Message.Content.Reply {
    String ename;
    String evalue;
    Integer execution_count;
    String[] traceback;

    Error(Integer execution_count, String ename, String evalue, String[] traceback) {
      this.execution_count = execution_count;
      this.ename = ename;
      this.evalue = evalue;
      this.traceback = traceback;
    }
  }

  static class ExecuteAbortReply extends ExecuteReply {
    ExecuteAbortReply(Integer execution_count) {
      super(ExecutionStatus.abort, execution_count);
    }
  }

  static class ExecuteErrorReply extends ExecuteReply {
    String ename;
    String evalue;
    String[] traceback;

    ExecuteErrorReply(Integer execution_count, String ename, String evalue, String[] traceback) {
      super(ExecutionStatus.error, execution_count);
      this.ename = ename;
      this.evalue = evalue;
      this.traceback = traceback;
    }
  }

  static class ExecuteInput extends Message.Content.Reply {
    String code;
    Integer execution_count;

    ExecuteInput(String code, Integer execution_count) {
      super();
      this.code = code;
      this.execution_count = execution_count;
    }
  }

  static class ExecuteOkReply extends ExecuteReply {
    List<Map<String, String>> payload;
    Map<String, String> user_expressions;
    List<String> user_variables;

    ExecuteOkReply(Integer execution_count, List<Map<String, String>> payload,
        List<String> user_variables, Map<String, String> user_expressions) {
      super(ExecutionStatus.ok, execution_count);
      this.payload = payload;
      this.user_variables = user_variables;
      this.user_expressions = user_expressions;
    }
  }

  static class ExecuteReply extends Message.Content.Reply {
    Integer execution_count;
    ExecutionStatus status;

    ExecuteReply(ExecutionStatus status, Integer execution_count) {
      this.status = status;
      this.execution_count = execution_count;
    }
  }

  static class ExecuteRequest extends Message.Content.Request {
    Boolean allow_stdin;
    String code;
    Boolean silent = false;
    Boolean store_history = !silent;
    Map<String, String> user_expressions;
    List<String> user_variables;

    ExecuteRequest(Boolean allow_stdin,
        String code,
        Boolean silent,
        Boolean store_history,
        Map<String, String> user_expressions,
        List<String> user_variables) {
      this.allow_stdin = allow_stdin;
      this.code = code;
      this.silent = silent;
      this.store_history = store_history;
      this.user_expressions = user_expressions;
      this.user_variables = user_variables;
    }
  }

  static class ExecuteResult extends Message.Content.Reply {
    Map<String, String> data;
    Integer execution_count;
    Map<String, String> metadata;

    ExecuteResult(Integer execution_count, Map<String, String> data, Map<String, String> metadata) {
      this.execution_count = execution_count;
      this.data = data;
      this.metadata = metadata;
    }
  }

  static enum ExecutionState {
    busy, idle, starting;
  }

  static enum ExecutionStatus {
    abort, error, ok;
  }

  static class Header {
    UUID msg_id;
    MessageType msg_type;
    UUID session;
    String username;

    Header() {

    }

    Header(UUID msgId, String username, UUID session, MessageType messageType) {
      this.msg_id = msgId;
      this.username = username;
      this.session = session;
      this.msg_type = messageType;
    }
  }

  static enum HistoryAccessType {
    range, search, tail;
  }

  static class InputReply extends Message.Content.Request {
    String value;
  }

  static class InputRequest extends Message.Content.Reply {
    String prompt;
  }

  static class KernelInfoReply extends Message.Content.Reply {
    String[] protocol_version;
    String[] ipython_version;
    String[] language_version;
    String language;

    KernelInfoReply(String[] protocol_version, String[] ipython_version, String[] language_version,
        String language) {
      this.protocol_version = protocol_version;
      this.ipython_version = ipython_version;
      this.language_version = language_version;
      this.language = language;
    }
  }

  static class KernelInfoRequest extends Message.Content.Request {

  }

  static class ObjectInfoReply extends Message.Content.Reply {
    Boolean found;
    String name;
  }

  static class ObjectInfoRequest extends Message.Content.Request {
    Integer detail_level;
    String oname;
  }

  static class ShutdownReply extends Message.Content.Reply {
    Boolean restart;

    ShutdownReply(Boolean restart) {
      this.restart = restart;
    }
  }

  static class ShutdownRequest extends Message.Content.Request {
    Boolean restart;
  }

  static class Status extends Message.Content.Reply {
    ExecutionState execution_state;

    Status(ExecutionState execution_state) {
      this.execution_state = execution_state;
    }
  }

  static class Stream extends Message.Content.Reply {
    enum StreamName {
      stderr, stdout
    }

    String data;
    StreamName name;

    Stream(StreamName name, String data) {
      this.name = name;
      this.data = data;
    }
  }

  static Map<String, String> emptyMetadata() {
    return new HashMap<String, String>();
  }
}
