// ScalarChartDataGenerator.java
//

package com.google.cloud.datalab.charting.data;

import java.util.*;

public final class ScalarChartDataGenerator extends ChartDataGenerator {

  @Override
  public List<Map<String, Object>> generateHeader(Object item, String[] fields) {
    List<Map<String, Object>> columns = new ArrayList<Map<String, Object>>();
    columns.add(createColumn("item", item.getClass()));

    return columns;
  }

  @Override
  public Map<String, Object> generateRow(Object item) {
    List<Map<String, Object>> cells = new ArrayList<Map<String, Object>>();
    cells.add(createCell(item));

    return createRow(cells);
  }
}
