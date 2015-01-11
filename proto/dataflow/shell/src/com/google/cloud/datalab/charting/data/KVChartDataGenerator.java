// KVChartDataGenerator.java
//

package com.google.cloud.datalab.charting.data;

import java.util.*;
import com.google.cloud.dataflow.sdk.values.*;

public final class KVChartDataGenerator extends ChartDataGenerator {

  @Override
  public List<Map<String, Object>> generateHeader(Object item, String[] fields) {
    KV<?, ?> kv = (KV<?, ?>)item;

    List<Map<String, Object>> columns = new ArrayList<Map<String, Object>>();
    columns.add(createColumn("key", kv.getKey().getClass()));
    columns.add(createColumn("value", kv.getValue().getClass()));

    return columns;
  }

  @Override
  public Map<String, Object> generateRow(Object item) {
    KV<?, ?> kv = (KV<?, ?>)item;

    List<Map<String, Object>> cells = new ArrayList<Map<String, Object>>();
    cells.add(createCell(kv.getKey()));
    cells.add(createCell(kv.getValue()));

    return createRow(cells);
  }
}
