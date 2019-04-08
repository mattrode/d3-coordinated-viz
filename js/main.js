//js by Matt Rodenberger, 2019

(function(){

//pseudo-global variables
var attrArray = ["2010","2011","2012","2013","2014","2015","2016"]; //list of attributes
var expressed = attrArray[0]; //initial attribute

//chart frame dimensions
var chartWidth = window.innerWidth * 0.408,
    chartHeight = 500,
    leftPadding = 60,
    rightPadding = 2,
    topBottomPadding = 10,
    chartInnerWidth = chartWidth - leftPadding - rightPadding,
    chartInnerHeight = chartHeight - topBottomPadding * 2,
    translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

//create a scale to size bars proportionally to frame and for axis
var yScale = d3.scale.linear()
    .range([463, 0])
    .domain([0, 181000]);

window.onload = setMap();
//set up choropleth map
function setMap(){

    //map frame dimensions
    var width = window.innerWidth * 0.55,
    height = 500;

    //create new svg container for the map
    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    //setting projection for map
    var projection = d3.geo.albers()

    var path = d3.geo.path()
        .projection(projection);

    //use queue to parallelize asynchronous data loading
    d3_queue.queue()
        .defer(d3.csv, "data/gdpPerCapReal.csv")
        .defer(d3.json, "data/AllCountries.topojson")
        .defer(d3.json, "data/USA.topojson")
        .await(callback);

    function callback(error, csvData, world, usa){

        //place graticule on the map
        setGraticule(map, path);

        //translate world and USA TopoJSON
        var northAmerica = topojson.feature(world, world.objects.AllCountries),
            statesAll = topojson.feature(usa, usa.objects.ne_110m_admin_1_states_provinces).features

        //add Europe countries to map
        var countries = map.append("path")
            .datum(northAmerica)
            .attr("class", "countries")
            .attr("d", path);
        //join csv data to GeoJSON enumeration units
        statesAll = joinData(statesAll, csvData);

        //create the color scale
        var colorScale = makeColorScale(csvData);

        //add enumeration units to the map
        setEnumerationUnits(statesAll, map, path, colorScale);

        //add coordinated visualization to the map
        setChart(csvData, colorScale);

        createDropdown(csvData)
    };
  };

  //function to create coordinated bar chart
  function setChart(csvData, colorScale){

      //create a second svg element to hold the bar chart
      var chart = d3.select("body")
          .append("svg")
          .attr("width", chartWidth)
          .attr("height", chartHeight)
          .attr("class", "chart");

      //create a rectangle for chart background fill
      var chartBackground = chart.append("rect")
          .attr("class", "chartBackground")
          .attr("width", chartInnerWidth)
          .attr("height", chartInnerHeight)
          .attr("transform", translate);

      //set bars for each state
      var bars = chart.selectAll(".bar")
          .data(csvData)
          .enter()
          .append("rect")
          .sort(function(a, b){
              return b[expressed]-a[expressed]
          })
          .attr("class", function(d){
              return "bar " + d.name;
          })
          .attr("width", chartInnerWidth / csvData.length - 1)
          .on("mouseover", highlight)
          .on("mouseout", dehighlight)
          .on("mousemove", moveLabel);

      var desc = bars.append("desc")
          .text('{"stroke": "none", "stroke-width": "0px"}');

      //create a text element for the chart title
      var chartTitle = chart.append("text")
          .attr("x", 275)
          .attr("y", 40)
          .attr("class", "chartTitle")


      //create vertical axis generator
      var yAxis = d3.svg.axis()
          .scale(yScale)
          .orient("left");

      //place axis
      var axis = chart.append("g")
          .attr("class", "axis")
          .attr("transform", translate)
          .call(yAxis);

      //create frame for chart border
      var chartFrame = chart.append("rect")
          .attr("class", "chartFrame")
          .attr("width", chartInnerWidth)
          .attr("height", chartInnerHeight)
          .attr("transform", translate);
      //set bar positions, heights, and colors
      updateChart(bars, csvData.length, colorScale);
  };
//function to create color scale generator
function makeColorScale(data){
    var colorClasses = [
        "#f2f0f7",
        "#cbc9e2",
        "#9e9ac8",
        "#756bb1",
        "#54278f"
    ];

    //create color scale generator
    var colorScale = d3.scale.quantile()
        .range(colorClasses);

    //build array of all values of the expressed attribute
    var domainArray = [];
    for (var i=0; i<data.length; i++){
        var val = parseFloat(data[i][expressed]);
        domainArray.push(val);
    };

    //assign array of expressed values as scale domain
    colorScale.domain(domainArray);
    return colorScale;


};

function setGraticule(map, path){
    var graticule = d3.geo.graticule()
        .step([5, 5]); //place graticule lines every 5 degrees of longitude and latitude

    //create graticule background
    var gratBackground = map.append("path")
        .datum(graticule.outline()) //bind graticule background
        .attr("class", "gratBackground") //assign class for styling
        .attr("d", path) //project graticule

    //create graticule lines
    var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
        .data(graticule.lines()) //bind graticule lines to each element to be created
        .enter() //create an element for each datum
        .append("path") //append each element to the svg as a path element
        .attr("class", "gratLines") //assign class for styling
        .attr("d", path); //project graticule lines
};

function joinData(statesAll, csvData){
    //loop through csv to assign each set of csv attribute values to geojson region
    for (var i=0; i<csvData.length; i++){
        var csvState = csvData[i]; //the current region
        var csvKey = csvState.name; //the CSV primary key

        //loop through geojson regions to find correct region
        for (var a=0; a<statesAll.length; a++){

            var geojsonProps = statesAll[a].properties; //the current region geojson properties
            var geojsonKey = geojsonProps.name; //the geojson primary key

            //where primary keys match, transfer csv data to geojson properties object
            if (geojsonKey == csvKey){

               //assign all attributes and values
               attrArray.forEach(function(attr){
                   var val = parseFloat(csvState[attr]); //get csv attribute value
                   geojsonProps[attr] = val; //assign attribute and value to geojson properties
             });
          };
      };
  };
    return statesAll;
};

//
function setEnumerationUnits(statesAll, map, path, colorScale){
    //add states to map
    var states = map.selectAll(".states")
      .data(statesAll)
      .enter()
      .append("path")
      .attr("class", function(d){
        return "states " + d.properties.name;
    })
     .attr("d", path)
     .style("fill", function(d){
        return colorScale(d.properties[expressed])
    })
     .style("fill", function(d){
        return choropleth(d.properties, colorScale);
    })
    .on("mouseover", function(d){
        highlight(d.properties);
    })
    .on("mouseout", function(d){
        dehighlight(d.properties);
    })
    .on("mousemove", moveLabel);

    var desc = states.append("desc")
        .text('{"stroke": "#000", "stroke-width": "0.5px"}');
};

//function to test for data value and return color
function choropleth(props, colorScale){
    //make sure attribute value is a number
    var val = parseFloat(props[expressed]);
    //if attribute value exists, assign a color; otherwise assign gray
    if (typeof val == 'number' && !isNaN(val)){
        return colorScale(val);
    } else {
        return "#CCC";
    };
};

//function to create a dropdown menu for attribute selection
function createDropdown(csvData){
    //add select element
     var dropdown = d3.select("body")
         .append("select")
         .attr("class", "dropdown")
         .on("change", function(){
             changeAttribute(this.value, csvData)
         });

    //add initial option
    var titleOption = dropdown.append("option")
        .attr("class", "titleOption")
        .attr("disabled", "true")
        .text("Select Attribute");

    //add attribute name options
    var attrOptions = dropdown.selectAll("attrOptions")
        .data(attrArray)
        .enter()
        .append("option")
        .attr("value", function(d){ return d })
        .text(function(d){ return d });
};
//dropdown change listener handler
function changeAttribute(attribute, csvData){
    //change the expressed attribute
    expressed = attribute;

    //recreate the color scale
    var colorScale = makeColorScale(csvData);

    //recolor enumeration units
    var states = d3.selectAll(".states")
        .transition()
        .duration(1000)
        .style("fill", function(d){
            return choropleth(d.properties, colorScale)
        });
    //re-sort, resize, and recolor bars
    var bars = d3.selectAll(".bar")
       //re-sort bars
       .sort(function(a, b){
           return b[expressed] - a[expressed];
      })
      .transition() //add animation
      .delay(function(d, i){
           return i * 20
      })
      .duration(500);

    //set bar positions, heights, and colors
    updateChart(bars, csvData.length, colorScale);
};
//function to position, size, and color bars in chart
function updateChart(bars, n, colorScale){
    //position bars
    bars.attr("x", function(d, i){
            return i * (chartInnerWidth / n) + leftPadding;
        })
        //size/resize bars
        .attr("height", function(d, i){
            return 463 - yScale(parseFloat(d[expressed]));
        })
        .attr("y", function(d, i){
            return yScale(parseFloat(d[expressed])) + topBottomPadding;
        })
        //color/recolor bars
        .style("fill", function(d){
            return choropleth(d, colorScale);
        })
    //create a text element for the chart title
    var chartTitle = d3.select(".chartTitle")
        .text("GDP in Thousands in  " + expressed)
        .style('fill', 'White');
};

//function to highlight enumeration units and bars
function highlight(props){
   //change stroke
   var selected = d3.selectAll("." + props.name)
       .style("stroke", "#e2ff07")
       .style("stroke-width", "5");
  setLabel(props)
};

//function to reset the element style on mouseout
function dehighlight(props){
   var selected = d3.selectAll("." + props.name)
       .style("stroke", function(){
           return getStyle(this, "stroke")
       })
       .style("stroke-width", function(){
           return getStyle(this, "stroke-width")
       });

   function getStyle(element, styleName){
       var styleText = d3.select(element)
           .select("desc")
           .text();

       var styleObject = JSON.parse(styleText);

       return styleObject[styleName];
   };
   d3.select(".infolabel")
    .remove();
};

//function to create dynamic label
function setLabel(props){

    //label content
    var labelAttribute = "<h1>" + props[expressed] +
        "</h1><b>" + expressed + "</b>";


    //create info label div
    var infolabel = d3.select("body")
        .append("div")
        .attr("class", "infolabel")
        .attr("id", props.name + "_label")
        .html(labelAttribute);

    var stateName = infolabel.append("div")
        .attr("class", "labelname")
        .html(props.name);

};

//function to move info label with mouse
function moveLabel(){
    //get width of label
    var labelWidth = d3.select(".infolabel")
        .node()
        .getBoundingClientRect()
        .width;

    //use coordinates of mousemove event to set label coordinates
    var x1 = d3.event.clientX + 10,
        y1 = d3.event.clientY - 75,
        x2 = d3.event.clientX - labelWidth - 10,
        y2 = d3.event.clientY + 25;

    //horizontal label coordinate, testing for overflow
    var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1;
    //vertical label coordinate, testing for overflow
    var y = d3.event.clientY < 75 ? y2 : y1;

    d3.select(".infolabel")
        .style("left", x + "px")
        .style("top", y + "px");
};
})();
