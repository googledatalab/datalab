// ChartDataGenerator.java
//

package com.google.cloud.datalab.charting.data;

import java.util.*;

public abstract class ChartDataGenerator {

  protected ChartDataGenerator() {
  }

  protected Map<String, Object> createCell(Object value) {
    Map<String, Object> cell = new HashMap<String, Object>();

    if ((value != null) && !ChartData.SupportedTypes.containsKey(value.getClass())) {
      value = value.toString();
    }
    cell.put("v", value);

    return cell;
  }

  protected Map<String, Object> createColumn(String name, Class<?> type) {
    String generatedType = ChartData.SupportedTypes.get(type);
    if (generatedType == null) {
      generatedType = "string";
    }

    Map<String, Object> column = new HashMap<String, Object>();
    column.put("id", name);
    column.put("label", name);
    column.put("type", generatedType);

    return column;
  }

  protected Map<String, Object> createRow(List<Map<String, Object>> cells) {
    Map<String, Object> row = new HashMap<String, Object>();
    row.put("c", cells);

    return row;
  }

  public abstract List<Map<String, Object>> generateHeader(Object item, String[] fields);

  public abstract Map<String, Object> generateRow(Object item);

}
