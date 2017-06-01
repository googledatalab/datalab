Module gcp.storage
------------------

Google Cloud Platform library - Cloud Storage Functionality.

Functions
---------
- **bucket** (name, context=None)

    Creates a Storage bucket object.
  
    Args:  

    * name: the name of the bucket.

    * context: an optional Context object providing project_id and credentials.  
Returns:    
A bucket object that can be used to work with the associated Storage bucket.

- **buckets** (context=None)

    Retrieves a list of Storage buckets.
  
    Args:  

    * context: an optional Context object providing project_id and credentials.  
Returns:    
An iteratable list of buckets.

Sub-modules
-----------
- [gcp.storage._api](_api.md)

- [gcp.storage._bucket](_bucket.md)

- [gcp.storage._item](_item.md)
Module gcp.storage._api
-----------------------

Implements Storage HTTP API wrapper.

Classes
-------
#### Api 
A helper class to issue Storage HTTP requests.

##### Ancestors (in MRO)
- gcp.storage._api.Api

- __builtin__.object

##### Instance variables
- **project_id**

    The project_id associated with this API client.

##### Methods
- **__init__** (self, credentials, project_id)

    Initializes the Storage helper with context information.
  
    Args:  

    * credentials: the credentials to use to authorize requests.

    * project_id: the project id to associate with requests.

- **buckets_get** (self, bucket, projection='noAcl')

    Issues a request to retrieve information about a bucket.
  
    Args:  

    * bucket: the name of the bucket.

    * projection: the projection of the bucket information to retrieve.  
Returns:    
A parsed bucket information dictionary.  
Raises:    
Exception if there is an error performing the operation.

- **buckets_insert** (self, bucket, projection='noAcl')

    Issues a request to create a new bucket.
  
    Args:  

    * bucket: the name of the bucket.

    * projection: the projection of the bucket information to retrieve.  
Returns:    
A parsed bucket information dictionary.  
Raises:    
Exception if there is an error performing the operation.

- **buckets_list** (self, projection='noAcl', max_results=0, page_token=None)

    Issues a request to retrieve the list of buckets.
  
    Args:  

    * projection: the projection of the bucket information to retrieve.

    * max_results: an optional maximum number of objects to retrieve.

    * page_token: an optional token to continue the retrieval.  
Returns:    
A parsed list of bucket information dictionaries.  
Raises:    
Exception if there is an error performing the operation.

- **object_download** (self, bucket, key)

    Reads the contents of an object as text.
  
    Args:  

    * bucket: the name of the bucket containing the object.

    * key: the key of the object to be read.  
Returns:    
The text content within the object.  
Raises:    
Exception if the object could not be read from.

- **object_upload** (self, bucket, key, content, content_type)

    Writes text content to the object.
  
    Args:  

    * bucket: the name of the bucket containing the object.

    * key: the key of the object to be read.

    * content: the text content to be writtent.

    * content_type: the type of text content.  
Raises:    
Exception if the object could not be written to.

- **objects_copy** (self, source_bucket, source_key, target_bucket, target_key)

    Updates the metadata associated with an object.
  
    Args:  

    * source_bucket: the name of the bucket containing the source object.

    * source_key: the key of the source object being copied.

    * target_bucket: the name of the bucket that will contain the copied object.

    * target_key: the key of the copied object.  
Returns:    
A parsed object information dictionary.  
Raises:    
Exception if there is an error performing the operation.

- **objects_delete** (self, bucket, key)

    Deletes the specified object.
  
    Args:  

    * bucket: the name of the bucket.

    * key: the key of the object within the bucket.  
Raises:    
Exception if there is an error performing the operation.

- **objects_get** (self, bucket, key, projection='noAcl')

    Issues a request to retrieve information about an object.
  
    Args:  

    * bucket: the name of the bucket.

    * key: the key of the object within the bucket.

    * projection: the projection of the object to retrieve.  
Returns:    
A parsed object information dictionary.  
Raises:    
Exception if there is an error performing the operation.

- **objects_list** (self, bucket, prefix=None, delimiter=None, projection='noAcl', versions=False, max_results=0, page_token=None)

    Issues a request to retrieve information about an object.
  
    Args:  

    * bucket: the name of the bucket.

    * prefix: an optional key prefix.

    * delimiter: an optional key delimiter.

    * projection: the projection of the objects to retrieve.

    * versions: whether to list each version of a file as a distinct object.

    * max_results: an optional maximum number of objects to retrieve.

    * page_token: an optional token to continue the retrieval.  
Returns:    
A parsed list of object information dictionaries.  
Raises:    
Exception if there is an error performing the operation.
Module gcp.storage._bucket
--------------------------

Implements Bucket-related Cloud Storage APIs.

Classes
-------
#### Bucket 
Represents a Cloud Storage bucket.

##### Ancestors (in MRO)
- gcp.storage._bucket.Bucket

- __builtin__.object

##### Instance variables
- **name**

    Returns the name of the bucket.

##### Methods
- **__init__** (self, api, name, info=None)

    Initializes an instance of a Bucket object.
  
    Args:  

    * api: the Storage API object to use to issue requests.

    * name: the name of the bucket.

    * info: the information about the bucket if available.

- **item** (self, key)

    Retrieves an object within this bucket.
  
    Args:  

    * key: the key of the item within the bucket.  
Returns:    
An Item instance representing the specified key.

- **items** (self, prefix=None, delimiter=None)

    Retrieve the list of items within this bucket.
  
    Args:  

    * prefix: an optional prefix to match items.

    * delimiter: an optional string to simulate directory-like semantics.  
Returns:    
An iterable list of items within this bucket.

- **metadata** (self)

    Retrieves metadata about the bucket.
  
    Returns:    
A BucketMetadata instance with information about this bucket.  
Raises:    
Exception if there was an error requesting the bucket's metadata.

#### BucketList 
Represents a list of Cloud Storage buckets.

##### Ancestors (in MRO)
- gcp.storage._bucket.BucketList

- __builtin__.object

##### Methods
- **__init__** (self, api)

    Initializes an instance of a BucketList.
  
    Args:  

    * api: the Storage API object to use to issue requests.

- **contains** (self, name)

    Checks if the specified bucket exists.
  
    Args:  

    * name: the name of the bucket to lookup.  
Returns:    
True if the bucket exists; False otherwise.  
Raises:    
Exception if there was an error requesting information about the bucket.

- **create** (self, name)

    Creates a new bucket.
  
    Args:  

    * name: a unique name for the new bucket.  
Returns:    
The newly created bucket.  
Raises:    
Exception if there was an error creating the bucket.

#### BucketMetadata 
Represents metadata about a Cloud Storage bucket.

##### Ancestors (in MRO)
- gcp.storage._bucket.BucketMetadata

- __builtin__.object

##### Instance variables
- **created_on**

    Gets the created timestamp of the bucket.

- **etag**

    Gets the ETag of the bucket.

- **name**

    Gets the name of the bucket.

##### Methods
- **__init__** (self, info)

    Initializes an instance of a BucketMetadata object.
  
    Args:  

    * info: a dictionary containing information about an Item.
Module gcp.storage._item
------------------------

Implements Object-related Cloud Storage APIs.

Classes
-------
#### Item 
Represents a Cloud Storage object within a bucket.

##### Ancestors (in MRO)
- gcp.storage._item.Item

- __builtin__.object

##### Instance variables
- **key**

    Returns the key of the item.

##### Methods
- **__init__** (self, api, bucket, key, info=None)

    Initializes an instance of an Item.
  
    Args:  

    * api: the Storage API object to use to issue requests.

    * bucket: the name of the bucket containing the item.

    * key: the key of the item.

    * info: the information about the item if available.

- **copy_to** (self, new_key)

    Copies this item to the specified new key.
  
    Args:  

    * new_key: the new key to copy this item to.  
Returns:    
An Item corresponding to new key.  
Raises:    
Exception if there was an error copying the item.

- **delete** (self)

    Deletes this item from its bucket.
  
    Returns  
True if the deletion succeeded; False otherwise.  
Raises:    
Exception if there was an error deleting the item.

- **metadata** (self)

    Retrieves metadata about the bucket.
  
    Returns:    
A BucketMetadata instance with information about this bucket.  
Raises:    
Exception if there was an error requesting the bucket's metadata.

- **read_from** (self)

    Reads the content of this item as text.
  
    Returns:    
The text content within the item.  
Raises:    
Exception if there was an error requesting the item's content.

- **write_to** (self, content, content_type)

    Writes text content to this item.
  
    Args:  

    * content: the text content to be written.

    * content_type: the type of text content.  
Raises:    
Exception if there was an error requesting the item's content.

#### ItemList 
Represents a list of Cloud Storage objects within a bucket.

##### Ancestors (in MRO)
- gcp.storage._item.ItemList

- __builtin__.object

##### Methods
- **__init__** (self, api, bucket, prefix, delimiter)

    Initializes an instance of an ItemList.
  
    Args:  

    * api: the Storage API object to use to issue requests.

    * bucket: the name of the bucket containing the items.

    * prefix: an optional prefix to match items.

    * delimiter: an optional string to simulate directory-like semantics.

- **contains** (self, key)

    Checks if the specified item exists.
  
    Args:  

    * key: the key of the item to lookup.  
Returns:    
True if the item exists; False otherwise.  
Raises:    
Exception if there was an error requesting information about the item.

#### ItemMetadata 
Represents metadata about a Cloud Storage object.

##### Ancestors (in MRO)
- gcp.storage._item.ItemMetadata

- __builtin__.object

##### Instance variables
- **content_type**

    Gets the Content-Type associated with the item.

- **etag**

    Gets the ETag of the item.

- **name**

    Gets the name of the item.

- **size**

    Gets the size (in bytes) of the item.

- **updated_on**

    Gets the updated timestamp of the item.

##### Methods
- **__init__** (self, info)

    Initializes an instance of a ItemMetadata object.
  
    Args:  

    * info: a dictionary containing information about an Item.
