var util = require("util");
var ServiceClass = require("./../ServiceClass");

function {{ serviceName }}(skautIS) {
  ServiceClass.call(this, skautIS);
  this.serviceName = "{{ serviceName }}";
  this.serviceLocation = "{{{ location }}}";
}

util.inherits({{ serviceName }}, ServiceClass);

{{#methods}}
{{ serviceName }}.prototype.{{methodName}} = function({{functionParams}}) {
  this.soapRequest("{{{soapAction}}}", "{{methodName}}", "{{requestTypeName}}", {{{requestParams}}}, {{{responseParams}}}, {{isArray}}, callback);
}
{{/methods}}

module.exports = {{ serviceName }};
