// MapChartDataGenerator.java
//

package com.google.cloud.datalab.charting.data;

import java.util.*;

public final class MapChartDataGenerator extends ChartDataGenerator {

  private List<String> _keys;

  @SuppressWarnings("unchecked")
  @Override
  public List<Map<String, Object>> generateHeader(Object item, String[] fields) {
    List<Map<String, Object>> columns = new ArrayList<Map<String, Object>>();
    _keys = new ArrayList<String>();

    Map<String, Object> data = (Map<String, Object>)item;
    for (Map.Entry<String, Object> entry: data.entrySet()) {
      String key = entry.getKey();
      Object value = entry.getValue();

      if ((value != null) && ChartData.SupportedTypes.containsKey(value.getClass())) {
        _keys.add(key);
        columns.add(createColumn(key, value.getClass()));
      }
    }

    return columns;
  }

  @SuppressWarnings("unchecked")
  @Override
  public Map<String, Object> generateRow(Object item) {
    Map<String, Object> data = (Map<String, Object>)item;

    List<Map<String, Object>> cells = new ArrayList<Map<String, Object>>();
    for (String key: _keys) {
      cells.add(createCell(data.get(key)));
    }

    return createRow(cells);
  }
}
