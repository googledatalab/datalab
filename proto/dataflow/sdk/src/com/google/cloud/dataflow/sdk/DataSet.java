// DataSet.java
//

package com.google.cloud.dataflow.sdk;

import com.google.cloud.dataflow.sdk.transforms.*;
import com.google.cloud.dataflow.sdk.values.*;

/**
 * Represents a logical dataset which can be used to create read transforms to read
 * in data as a PCollection, or write transforms to write out data within a PCollection.
 * @param <T> the type of items in associated PCollection instances.
 */
public final class DataSet<T> {

  private final Mode _mode;

  private final Dataflow _dataflow;
  private final String _name;
  private final PTransform<PInput, PCollection<T>> _readTransform;
  private final PTransform<PCollection<T>, POutput> _writeTransform;

  private PTransform<PInput, PCollection<T>> _reader;
  private PTransform<PCollection<T>, POutput> _writer;

  /**
   * Initializes an instance of a DataSet.
   * @param mode whether this dataset represents a source to read from or a target to write to.
   * @param dataflow the containing dataflow that serves as the data registry.
   * @param name the name that is used to lookup the registry.
   * @param readTransform the transform to use to read, if the name cannot be resolved.
   * @param writeTransform the transform to use to write, if the name cannot be resolved.
   */
  DataSet(Mode mode, Dataflow dataflow, String name,
          PTransform<PInput, PCollection<T>> readTransform,
          PTransform<PCollection<T>, POutput> writeTransform) {
    _mode = mode;
    _dataflow = dataflow;
    _name = name;
    _readTransform = readTransform;
    _writeTransform = writeTransform;
  }

  /**
   * Provides a read transform representing this dataset.
   * @return a transform to read in a PCollection.
   */
  public PTransform<PInput, PCollection<T>> reader() {
    if (_mode != Mode.Reader) {
      throw new IllegalStateException("A DataSet for a write target cannot be read from.");
    }

    if (_reader == null) {
      _reader = _dataflow.resolveReader(_name);
      if (_reader == null) {
        // Nothing registered in the registry ... expectation is the developer has provided
        // a custom read transform via withReader.

        _reader = _readTransform;
      }

      if (_reader == null) {
        throw new IllegalStateException("A DataSet with name '" + _name +
                                        "' could not be resolved. " +
            "A default read transform should be provided at construction time.");
      }
      else {
        _reader.setName(_name);
      }
    }

    return _reader;
  }

  /**
   * Provides a write transform representing this dataset.
   * @return a transform to write out a PCollection.
   */
  public PTransform<PCollection<T>, POutput> writer() {
    if (_mode != Mode.Writer) {
      throw new IllegalStateException("A DataSet for a read source cannot be written to.");
    }

    if (_writer == null) {
      _writer = _dataflow.resolveWriter(_name);
      if (_writer == null) {
        // Nothing registered in the registry ... expectation is the developer has provided
        // custom write transform for creating one via withWriter.

        _writer = _writeTransform;
      }

      if (_writer == null) {
        throw new IllegalStateException("A DataSet with name '" + _name +
                                        "' could not be resolved. " +
            "A default write transform should be provided at construction time.");
      }
      else {
        _writer.setName(_name);
      }
    }

    return _writer;
  }


  public enum Mode {

    Reader,

    Writer
  }
}
