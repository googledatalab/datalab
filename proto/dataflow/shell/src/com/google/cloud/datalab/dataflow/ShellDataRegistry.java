// ShellDataRegistry.java
//

package com.google.cloud.datalab.dataflow;

import java.util.*;
import com.google.cloud.dataflow.sdk.*;
import com.google.cloud.dataflow.sdk.coders.*;
import com.google.cloud.dataflow.sdk.runners.*;
import com.google.cloud.dataflow.sdk.transforms.*;
import com.google.cloud.dataflow.sdk.transforms.windowing.*;
import com.google.cloud.dataflow.sdk.values.*;
import ijava.extensibility.*;

/**
 * Implements a registry of named collections defined within the shell.
 */
public final class ShellDataRegistry implements DataRegistry {

  private final Shell _shell;
  private final HashMap<String, Save<?>> _saveTransforms;

  static {
    DirectPipelineRunner.registerDefaultTransformEvaluator(Load.class, new Load.Evaluator());
    DirectPipelineRunner.registerDefaultTransformEvaluator(Save.class, new Save.Evaluator());
  }

  public ShellDataRegistry(Shell shell) {
    _shell = shell;
    _saveTransforms = new HashMap<String, Save<?>>();
  }

  public Set<String> captureCollections() {
    for (Map.Entry<String, Save<?>> transformEntry: _saveTransforms.entrySet()) {
      _shell.declareVariable(transformEntry.getKey(), "List");
      _shell.setVariable(transformEntry.getKey(), transformEntry.getValue().getItems());
    }

    return _saveTransforms.keySet();
  }

  /**
   * {@link DataRegistry}
   */
  @Override
  @SuppressWarnings({ "unchecked" })
  public <T> PTransform<PInput, PCollection<T>> resolveReader(String name) {
    Object value = _shell.getVariable(name);
    if (value == null) {
      return null;
    }

    if (!List.class.isAssignableFrom(value.getClass())) {
      throw new IllegalStateException("The value associated with the name '" + name + "' is of " +
          "type '" + value.getClass().getName() + "' and is not a list.");
    }

    return new Load<T>((List<T>)value);
  }

  /**
   * {@link DataRegistry}
   */
  @Override
  public <T> PTransform<PCollection<T>, POutput> resolveWriter(String name) {
    Save<T> saveTransform = new Save<T>();
    _saveTransforms.put(name, saveTransform);

    return saveTransform;
  }


  @SuppressWarnings({ "rawtypes", "serial" })
  private static final class Load<T> extends PTransform<PInput, PCollection<T>> {

    private final List<T> _items;
    private PCollection<T> _collection;

    public Load(List<T> items) {
      _items = items;
    }

    @Override
    public PCollection<T> apply(PInput input) {
      _collection = PCollection.<T>createPrimitiveOutputInternal(new GlobalWindow());

      if (_items.size() != 0) {
        CoderRegistry coderRegistry = input.getPipeline().getCoderRegistry();
        Coder<T> coder = coderRegistry.getDefaultCoder(_items.get(0));

        if (coder != null) {
          _collection.setCoder(coder);
        }
      }

      return _collection;
    }

    public static final class Evaluator implements DirectPipelineRunner.TransformEvaluator<Load> {

      @SuppressWarnings("unchecked")
      @Override
      public void evaluate(Load transform, DirectPipelineRunner.EvaluationContext context) {
        context.setPCollection(transform._collection, transform._items);
      }
    }
  }

  @SuppressWarnings({ "rawtypes", "serial" })
  private static final class Save<T> extends PTransform<PCollection<T>, POutput> {

    private List<T> _items;
    private PCollection<T> _collection;

    public List<T> getItems() {
      return _items;
    }

    @Override
    public POutput apply(PCollection<T> collection) {
      _collection = collection;
      return new PDone();
    }

    public static final class Evaluator implements DirectPipelineRunner.TransformEvaluator<Save> {

      @SuppressWarnings("unchecked")
      @Override
      public void evaluate(Save transform, DirectPipelineRunner.EvaluationContext context) {
        transform._items = context.getPCollection(transform._collection);
      }
    }
  }
}
