/*
 * Copyright 2014 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing permissions and limitations under
 * the License.
 */

package com.google.cloud.ijava.communication;

import com.google.common.annotations.VisibleForTesting;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonDeserializationContext;
import com.google.gson.JsonDeserializer;
import com.google.gson.JsonElement;
import com.google.gson.JsonParseException;
import com.google.gson.JsonSerializationContext;
import com.google.gson.JsonSerializer;
import com.google.gson.reflect.TypeToken;

import java.lang.reflect.Type;
import java.util.HashMap;
import java.util.UUID;

/**
 * A helper class for creating a {@link Gson} object for converting object from/to JSON format.
 */
public class KernelJsonConverter {
  public static Gson GSON =
      new GsonBuilder().registerTypeAdapter(UUID.class, new UUIDTypeConverter()).create();
  public static Gson PRETTY_GSON = new GsonBuilder()
      .registerTypeAdapter(UUID.class, new UUIDTypeConverter()).setPrettyPrinting().create();

  public static final Type METADATA_TYPE = new TypeToken<HashMap<String, String>>() {}.getType();

  private KernelJsonConverter() {}

  @VisibleForTesting
  static class UUIDTypeConverter implements JsonSerializer<UUID>, JsonDeserializer<UUID> {

    @Override
    public UUID deserialize(JsonElement json, Type typeOfT, JsonDeserializationContext context)
        throws JsonParseException {
      // Java UUID class needs the UUID string to be in a certain format. This logic converts the
      // incoming UUID to the required format.
      String lowerUUID = json.getAsString().toLowerCase();
      if (!lowerUUID.contains("-")) {
        return UUID.fromString(String.format("%s-%s-%s-%s-%s",
            lowerUUID.substring(0, 8),
            lowerUUID.substring(8, 12),
            lowerUUID.substring(12, 16),
            lowerUUID.substring(16, 20),
            lowerUUID.substring(20)));
      } else {
        return UUID.fromString(lowerUUID);
      }
    }

    @Override
    public JsonElement serialize(UUID uuid, Type typeOfSrc, JsonSerializationContext context) {
      return context.serialize(uuid.toString().replace("-", "").toUpperCase());
    }
  }
}
