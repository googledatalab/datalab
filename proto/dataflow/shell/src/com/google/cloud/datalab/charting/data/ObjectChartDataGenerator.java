// ObjectChartDataGenerator.java
//

package com.google.cloud.datalab.charting.data;

import java.beans.*;
import java.lang.reflect.*;
import java.util.*;

public final class ObjectChartDataGenerator extends ChartDataGenerator {

  private List<Field> _fields;
  private List<Method> _getters;

  @Override
  public List<Map<String, Object>> generateHeader(Object item, String[] fields) {
    List<Map<String, Object>> columns = new ArrayList<Map<String, Object>>();

    _fields = new ArrayList<Field>();
    _getters = new ArrayList<Method>();

    try {
      Class<?> itemClass = item.getClass();

      Field[] allFields = itemClass.getFields();
      for (Field f: allFields) {
        if ((f.getModifiers() & Modifier.STATIC) != 0) {
          continue;
        }
        if (!ChartData.SupportedTypes.containsKey(f.getType())) {
          continue;
        }

        if ((f.getModifiers() & Modifier.STATIC) == 0) {
          _fields.add(f);
          columns.add(createColumn(f.getName(), f.getType()));
        }
      }

      BeanInfo beanInfo = Introspector.getBeanInfo(itemClass);
      for (PropertyDescriptor pd: beanInfo.getPropertyDescriptors()) {
        String name = pd.getName();
        if (name.equals("class")) {
          continue;
        }

        Object value = null;
        try {
          value = pd.getReadMethod().invoke(item);
        }
        catch (Exception e) {
        }
        if ((value == null) || !ChartData.SupportedTypes.containsKey(value.getClass())) {
          continue;
        }

        _getters.add(pd.getReadMethod());
        columns.add(createColumn(name, value.getClass()));
      }
    }
    catch (IntrospectionException e) {
    }

    return columns;
  }

  @Override
  public Map<String, Object> generateRow(Object item) {
    List<Map<String, Object>> cells = new ArrayList<Map<String, Object>>();
    for (Field f: _fields) {
      Object value = null;
      try {
        value = f.get(item);
      }
      catch (Exception e) {
      }

      cells.add(createCell(value));
    }

    for (Method getter: _getters) {
      Object value = null;
      try {
        value = getter.invoke(item);
      }
      catch (Exception e) {
      }

      cells.add(createCell(value));
    }

    return createRow(cells);
  }
}
