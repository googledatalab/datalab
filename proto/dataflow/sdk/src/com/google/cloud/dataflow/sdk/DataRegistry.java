// PCollectionRegistry.java
//

package com.google.cloud.dataflow.sdk;

import com.google.cloud.dataflow.sdk.transforms.*;
import com.google.cloud.dataflow.sdk.values.*;

/**
 * Provides the ability to resolve reader and writer transforms associated with named
 * collections.
 */
public interface DataRegistry {

  /**
   * Resolves a read transform associated with the specified collection, if it exists.
   * @param name the name to lookup and resolve.
   * @return the transform to be used to read the collection; null if it can't be found..
   */
  public <T> PTransform<PInput, PCollection<T>> resolveReader(String name);

  /**
   * Resolves a write transform associated with the specified collection, if it exists.
   * @param name the name to lookup and resolve.
   * @return the transform to be used to write to the collection; null if it can't be found..
   */
  public <T> PTransform<PCollection<T>, POutput> resolveWriter(String name);
}
