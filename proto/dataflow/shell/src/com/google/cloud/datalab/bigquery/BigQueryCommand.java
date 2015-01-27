// BigQueryCommand.java
//

package com.google.cloud.datalab.bigquery;

import java.util.*;
import com.beust.jcommander.*;
import com.google.api.services.bigquery.*;
import com.google.api.services.bigquery.model.*;
import com.google.cloud.datalab.*;
import ijava.extensibility.*;

public class BigQueryCommand extends Command<BigQueryCommand.Options> {

  private final Cloud _cloud;

  public BigQueryCommand(Shell shell) {
    super(shell, Options.class, /* singleLine */ false);
    _cloud = Cloud.get();
  }

  @Override
  public Object evaluate(Options options, long evaluationID,
                         Map<String, Object> metadata) throws Exception {
    if (options.getCommand().equals(SQLOptions.NAME)) {
      return evaluateSQL(options.getContent(), options.sql,
                         evaluationID,
                         metadata);
    }

    return null;
  }

  private Object evaluateSQL(String sql, SQLOptions options, long evaluationID,
                             Map<String, Object> metadata) throws Exception {
    QueryRequest query = new QueryRequest().setQuery(sql);
    Bigquery.Jobs.Query queryRequest =
        _cloud.bigQuery().jobs().query(_cloud.projectId(), query);
    QueryResponse queryResponse = queryRequest.execute();
    List<TableRow> rows = queryResponse.getRows();

    List<Map<String, Object>> dataRows = null;

    if (options.simpleObjects || options.name.isEmpty()) {
      dataRows = new ArrayList<Map<String, Object>>();

      List<TableFieldSchema> schema = queryResponse.getSchema().getFields();
      for (TableRow row: rows) {
        Map<String, Object> dataRow = new HashMap<String, Object>();

        int i = 0;
        for (TableCell cell: row.getF()) {
          dataRow.put(schema.get(i).getName(), cell.getV());
          i++;
        }

        dataRows.add(dataRow);
      }
    }

    if (options.name.isEmpty()) {
      return new ijava.data.Table(dataRows);
    }
    else {
      Shell shell = getShell();

      if (options.simpleObjects) {
        shell.declareVariable(options.name, "List<Map<String, Object>>");
        shell.setVariable(options.name, dataRows);
      }
      else {
        shell.addImport("com.google.api.services.bigquery.model.*", /* static */ false);
        shell.declareVariable(options.name, "List<TableRow>");
        shell.setVariable(options.name, rows);
      }
    }

    return null;
  }

  public static final class Options extends CommandOptions {

    public SQLOptions sql = new SQLOptions();

    @Override
    public JCommander createParser(String name, String[] arguments, String content) {
      JCommander parser = super.createParser(name, arguments, content);
      parser.addCommand(SQLOptions.NAME, sql);

      return parser;
    }
  }

  public static final class SQLOptions {

    public static final String NAME = "sql";

    @Parameter(names = "--name", description = "The name of the variable to create")
    public String name = "";

    @Parameter(names = "--simpleObjects",
        description = "If BigQuery rows should be represented as simple Java Map objects")
    public boolean simpleObjects;
  }
}
