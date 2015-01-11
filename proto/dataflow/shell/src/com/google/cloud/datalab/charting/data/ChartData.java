// ChartData.java
//

package com.google.cloud.datalab.charting.data;

import java.util.*;
import com.google.cloud.dataflow.sdk.values.*;

public final class ChartData {

  public static final HashMap<Class<?>, String> SupportedTypes;

  static {
    SupportedTypes = new HashMap<Class<?>, String>();
    ChartData.SupportedTypes.put(Boolean.class, "boolean");
    ChartData.SupportedTypes.put(Byte.class, "number");
    ChartData.SupportedTypes.put(Double.class, "number");
    ChartData.SupportedTypes.put(Float.class, "number");
    ChartData.SupportedTypes.put(Integer.class, "number");
    ChartData.SupportedTypes.put(Long.class, "number");
    ChartData.SupportedTypes.put(Short.class, "number");
    ChartData.SupportedTypes.put(Character.class, "string");
    ChartData.SupportedTypes.put(String.class, "string");

    // TODO: Support for Dates
  }

  private ChartData() {
    // TODO Auto-generated constructor stub
  }

  public static Map<String, Object> createDataTable(List<?> items, String[] fields) {
    List<Map<String, Object>> columns = null;
    List<Map<String, Object>> rows = null;

    if (!items.isEmpty()) {
      ChartDataGenerator generator = null;

      Object sampleItem = items.get(0);
      Class<?> itemClass = sampleItem.getClass();
      if (ChartData.SupportedTypes.containsKey(itemClass)) {
        generator = new ScalarChartDataGenerator();
      }
      else if (Map.class.isAssignableFrom(itemClass)) {
        generator = new MapChartDataGenerator();
      }
      else if (itemClass == KV.class) {
        generator = new KVChartDataGenerator();
      }
      else {
        generator = new ObjectChartDataGenerator();
      }

      columns = generator.generateHeader(sampleItem, fields);
      rows = new ArrayList<Map<String, Object>>();

      for (Object item: items) {
        rows.add(generator.generateRow(item));
      }
    }

    Map<String, Object> chartData = new HashMap<String, Object>();
    chartData.put("cols", columns);
    chartData.put("rows", rows);

    return chartData;
  }
}
