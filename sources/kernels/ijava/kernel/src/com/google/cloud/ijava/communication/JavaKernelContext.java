package com.google.cloud.ijava.communication;

import com.google.cloud.ijava.runner.JavaExecutionEngine;

/**
 * This class carries important objects which is used for handling messages in the Java kernel.
 */
public class JavaKernelContext {
  public final KernelCommunicationHandler kernelCommunicationHandler;
  public final ConnectionProfile connectionProfile;
  public final JavaExecutionEngine javaExecutionEngine;

  public JavaKernelContext(KernelCommunicationHandler kernelCommunicationHandler,
      ConnectionProfile connectionProfile, JavaExecutionEngine javaExecutionEngine) {
    this.kernelCommunicationHandler = kernelCommunicationHandler;
    this.connectionProfile = connectionProfile;
    this.javaExecutionEngine = javaExecutionEngine;
  }
}
