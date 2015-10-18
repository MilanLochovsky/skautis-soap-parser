var http = require('http');
var parseString = require('xml2js').parseString;
var fs = require('fs');
var Mustache = require('mustache');

var services = ["OrganizationUnit", "UserManagement", "Telephony"];

for(var i = 0; i < services.length; i++) {
  getForService(services[i]);
}

function getForService(serviceName) {
  console.log("=== Start downloading WSDL for " + serviceName);
  http.get("http://test-is.skaut.cz/JunakWebservice/" + serviceName + ".asmx?WSDL", function(res) {
    var body = '';
    res.on('data', function(chunk) {
      body += chunk;
    });
    res.on('end', function() {
      console.log("== WSDL for " + serviceName + " downloaded");
      parseString(body, function (err, result) {
        console.log("== XML2JS parse done");
        var targetNamespace = result['wsdl:definitions']['$']['targetNamespace'];
        var serviceName = result['wsdl:definitions']['wsdl:service'][0]['$']['name'];
        var location = result['wsdl:definitions']['wsdl:service'][0]['wsdl:port'][0]['soap:address'][0]['$']['location'];
        var portName = result['wsdl:definitions']['wsdl:service'][0]['wsdl:port'][0]['$']['name']
        var portTypeName = null;

        var functions = [];

        // Binding funkci

        for(var key in result['wsdl:definitions']['wsdl:binding']) {
          if(result['wsdl:definitions']['wsdl:binding'][key]['$']['name'] == portName) {
            portTypeName = result['wsdl:definitions']['wsdl:binding'][key]['$']['type'].split(':')[1];

            for(var op in result['wsdl:definitions']['wsdl:binding'][key]['wsdl:operation']) {
              var functionName = result['wsdl:definitions']['wsdl:binding'][key]['wsdl:operation'][op]['$']['name'];
              var soapAction = result['wsdl:definitions']['wsdl:binding'][key]['wsdl:operation'][op]['soap:operation'][0]['$']['soapAction'];
              functions.push({name: functionName, soapAction: soapAction});
              console.log("== Parse function " + functionName);
            }
          }
        }

        // Neco

        for(var key in result['wsdl:definitions']['wsdl:portType']) {
          if(result['wsdl:definitions']['wsdl:portType'][key]['$']['name'] == portTypeName) {
            for(var op in result['wsdl:definitions']['wsdl:portType'][key]['wsdl:operation']) {
              for(var f in functions) {
                if(functions[f].name == result['wsdl:definitions']['wsdl:portType'][key]['wsdl:operation'][op]['$']['name']) {
                  //functions[f].description = result['wsdl:definitions']['wsdl:portType'][key]['wsdl:operation'][op]['wsdl:documentation'][0]['_'];
                  functions[f].input = result['wsdl:definitions']['wsdl:portType'][key]['wsdl:operation'][op]['wsdl:input'][0]['$']['message'].split(":")[1];
                  functions[f].output = result['wsdl:definitions']['wsdl:portType'][key]['wsdl:operation'][op]['wsdl:output'][0]['$']['message'].split(":")[1];
                }
              }
            }
          }
        }

        for(var key in result['wsdl:definitions']['wsdl:message']) {
          for(var f in functions) {
            if(functions[f].input == result['wsdl:definitions']['wsdl:message'][key]['$']['name']) {
              functions[f].requestType = result['wsdl:definitions']['wsdl:message'][key]['wsdl:part'][0]['$']['element'].split(":")[1]
            }

            if(functions[f].output == result['wsdl:definitions']['wsdl:message'][key]['$']['name']) {
              functions[f].responseType = result['wsdl:definitions']['wsdl:message'][key]['wsdl:part'][0]['$']['element'].split(":")[1]
            }
          }
        }

        for(var key in result['wsdl:definitions']['wsdl:types'][0]['s:schema']) {
          if(result['wsdl:definitions']['wsdl:types'][0]['s:schema'][key]['$']['targetNamespace'] == targetNamespace) {
            for(var e in result['wsdl:definitions']['wsdl:types'][0]['s:schema'][key]['s:element']) {
              var name = result['wsdl:definitions']['wsdl:types'][0]['s:schema'][key]['s:element'][e]['$']['name'];
              for(var f in functions) {
                if(functions[f].requestType == name) {
                  functions[f].requestTypeName = result['wsdl:definitions']['wsdl:types'][0]['s:schema'][key]['s:element'][e]['s:complexType'][0]['s:sequence'][0]['s:element'][0]['$']['name'];
                  functions[f].requestTypeType = result['wsdl:definitions']['wsdl:types'][0]['s:schema'][key]['s:element'][e]['s:complexType'][0]['s:sequence'][0]['s:element'][0]['$']['type'].split(":")[1];
                }

                if(functions[f].responseType == name) {
                  console.log("== Parse response types for function " + functions[f].name);
                  if(typeof result['wsdl:definitions']['wsdl:types'][0]['s:schema'][key]['s:element'][e]['s:complexType'][0]['s:sequence'] != "undefined") {
                    functions[f].responseTypeName = result['wsdl:definitions']['wsdl:types'][0]['s:schema'][key]['s:element'][e]['s:complexType'][0]['s:sequence'][0]['s:element'][0]['$']['name'];
                    if(typeof (functions[f].responseTypeType = result['wsdl:definitions']['wsdl:types'][0]['s:schema'][key]['s:element'][e]['s:complexType'][0]['s:sequence'][0]['s:element'][0]['$']['type']) != "undefined") {
                      functions[f].responseTypeType = result['wsdl:definitions']['wsdl:types'][0]['s:schema'][key]['s:element'][e]['s:complexType'][0]['s:sequence'][0]['s:element'][0]['$']['type'].split(":")[1];
                    }
                  }
                }
              }
            }


            for(var e in result['wsdl:definitions']['wsdl:types'][0]['s:schema'][key]['s:complexType']) {
              var name = result['wsdl:definitions']['wsdl:types'][0]['s:schema'][key]['s:complexType'][e]['$']['name'];
              for(var f in functions) {
                if(functions[f].requestTypeType == name) {
                  var params = [];
                  for(var p in result['wsdl:definitions']['wsdl:types'][0]['s:schema'][key]['s:complexType'][e]['s:sequence'][0]['s:element']) {
                    var paramName = result['wsdl:definitions']['wsdl:types'][0]['s:schema'][key]['s:complexType'][e]['s:sequence'][0]['s:element'][p]['$']['name'];
                    var paramType = result['wsdl:definitions']['wsdl:types'][0]['s:schema'][key]['s:complexType'][e]['s:sequence'][0]['s:element'][p]['$']['type'];
                    var nullable = typeof result['wsdl:definitions']['wsdl:types'][0]['s:schema'][key]['s:complexType'][e]['s:sequence'][0]['s:element'][p]['$']['nillable'] != "undefined" ? result['wsdl:definitions']['wsdl:types'][0]['s:schema'][key]['s:complexType'][e]['s:sequence'][0]['s:element'][p]['$']['nillable'] == "true" : false;

                    if(typeof result['wsdl:definitions']['wsdl:types'][0]['s:schema'][key]['s:complexType'][e]['s:sequence'][0]['s:element'][p]['$']['minOccurs'] != "undefined" && result['wsdl:definitions']['wsdl:types'][0]['s:schema'][key]['s:complexType'][e]['s:sequence'][0]['s:element'][p]['$']['minOccurs'] == "0") {
                      nullable = true;
                    }

                    params.push({paramName: paramName, paramType: paramType, nullable: nullable});
                  }
                  functions[f].requestParams = params;
                }


                if(functions[f].responseTypeType == name) {
                  var params = [];
                  for(var p in result['wsdl:definitions']['wsdl:types'][0]['s:schema'][key]['s:complexType'][e]['s:sequence'][0]['s:element']) {
                    var paramName = result['wsdl:definitions']['wsdl:types'][0]['s:schema'][key]['s:complexType'][e]['s:sequence'][0]['s:element'][p]['$']['name'];
                    var paramType = result['wsdl:definitions']['wsdl:types'][0]['s:schema'][key]['s:complexType'][e]['s:sequence'][0]['s:element'][p]['$']['type'];
                    params.push({paramName: paramName, paramType: paramType});
                  }
                  if(paramType.indexOf("tns:") == -1) {
                    functions[f].responseParams = params;
                  }
                  else {
                    var name = paramType.split(":")[1];
                    var params = [];
                    for(var a in result['wsdl:definitions']['wsdl:types'][0]['s:schema'][0]['s:complexType']) {
                     if(result['wsdl:definitions']['wsdl:types'][0]['s:schema'][0]['s:complexType'][a]['$']['name'] == name) {
                      for(var b in result['wsdl:definitions']['wsdl:types'][0]['s:schema'][0]['s:complexType'][a]['s:sequence'][0]['s:element']) {
                        var paramName = result['wsdl:definitions']['wsdl:types'][0]['s:schema'][0]['s:complexType'][a]['s:sequence'][0]['s:element'][b]['$']['name'];
                        var paramType = result['wsdl:definitions']['wsdl:types'][0]['s:schema'][0]['s:complexType'][a]['s:sequence'][0]['s:element'][b]['$']['type'];
                        params.push({paramName: paramName, paramType: paramType});
                      }
                     }
                    }
                    functions[f].responseParamsArray = params;
                  }
                }
              }
            }
          }
        }

        //console.dir(result['wsdl:definitions']['wsdl:types'][0]['s:schema']);
        //console.log("\n\nService name: " + serviceName + "\nNamespace: " + targetNamespace + "\nLocation: " + location + "\nPort name: " + portName + "\nFunkce:\n");
        //console.dir(functions, {depth: 100});

        genFunctions({serviceName : serviceName, namespace: targetNamespace, location: location, functions: functions });
      });
    });;
  });
}

function getType(type) {
  if(typeof type == "undefined") {
    return "string";
  }
  if(type.indexOf("bool") != -1) {
    return "bool";
  }
  if(type.indexOf("float") != -1) {
    return "float";
  }
  if(type.indexOf("decimal") != -1) {
    return "float";
  }
  if(type.indexOf("int") != -1) {
    return "int";
  }

  return "string";
}

function genFunctions(cls) {
  fs.readFile('./templates/Class.tpl', function (err, data) {
    var template = data.toString();

    console.log("\n=== Start generate functions for " + cls.serviceName);

    var renderData = {
      serviceName: cls.serviceName,
      location: cls.location,
      methods: []
    };


    for(var i = 0; i<cls.functions.length; i++)//5;i++)//
    {
        var f = cls.functions[i];
        //console.dir(f, {depth: 5});

        console.log("== Process method - " + f.name);

        var functionParams = [];
        for(var k in f.requestParams) {
          functionParams.push(f.requestParams[k].paramName);
        }

        functionParams.push("callback");

        var requestParamsArray = [];
        for(var k in f.requestParams) {
          var type = getType(f.requestParams[k].paramType);
          requestParamsArray.push('{name: "' + f.requestParams[k].paramName + '", type: "' + type + '", value: ' + f.requestParams[k].paramName + ', nullable: ' + f.requestParams[k].nullable + '}');
        }

        renderData.methods.push(
          {
            soapAction: f.soapAction,
            methodName: f.name,
            requestTypeName: f.requestTypeName,
            isArray: (typeof f.responseTypeType == "undefined") ? false : f.responseTypeType.toLowerCase().indexOf("array") != -1,
            functionParams: (typeof f.requestParams == "undefined") ? "" : functionParams.join(', '),
            requestParams: "[" + requestParamsArray.join(", ") + "]",
            responseParams: (typeof f.responseParams == "undefined") ? "[]" : JSON.stringify(f.responseParams)
          }
        );
    }

    var rendered = Mustache.render(template, renderData);

    fs.writeFile('./../node-skautis/services/' + cls.serviceName + '.js', rendered, function (err) {
      if (err) {
        console.dir(err);
      }
      console.log("=== " + cls.serviceName + ".js uloženo!");
    });
  });
}
