Module gcp._context
-------------------

Implements Context functionality.

Classes
-------
#### Context 
Maintains contextual state for connecting to Cloud APIs.

##### Ancestors (in MRO)
- gcp._context.Context

- __builtin__.object

##### Static methods
- **default** ()

    Creates a default Context object.
  
    The default Context is based on project id and credentials inferred from
metadata returned by the cloud metadata service. It is also managed as a
global shared instance used everytime the default context is retrieved.
  
    Returns:    
An initialized and shared instance of a Context object.

##### Instance variables
- **credentials**

    Retrieves the value of the credentials property.
  
    Returns:    
The current credentials used in authorizing API requests.

- **project_id**

    Retrieves the value of the project_id property.
  
    Returns:    
The current project id to associate with API requests.

##### Methods
- **__init__** (self, project_id, credentials)

    Initializes an instance of a Context object.
  
    Args:  

    * project_id: the current cloud project.

    * credentials: the credentials to use to authorize requests.
