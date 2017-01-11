{%- extends 'full.tpl' -%}

{% block html_head %}
{{ super() }}

<script type="text/javascript" charset="utf-8" async="" data-requirecontext="_" data-requiremodule="extensions/charting">
{% include "charting.js" %}
</script>
<script type="text/javascript" charset="utf-8" async="" data-requirecontext="_" data-requiremodule="element">
{% include "element.js" %}
</script>
<script type="text/javascript" charset="utf-8" async="" data-requirecontext="_" data-requiremodule="style">
{% include "style.js" %}
</script>
<script type="text/javascript" charset="utf-8" async="" data-requirecontext="_" data-requiremodule="visualization">
{% include "visualization.js" %}
document._in_nbconverted = true;
</script>

<style type="text/css">
{% include "custom.css" %}
{% include "charting.css" %}
{% include "datalab.css" %}
</style>

{% endblock html_head %}

