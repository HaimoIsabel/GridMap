// var gridSize = 500*1.25;
var population = 0;
var numberFormat = function (n) { // Thousand seperator
        return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    };
// define color range
var colorScale = d3.scaleQuantile()
    .range(['#FFEDA0', '#FED976', '#FEB24C', '#FD8D3C', '#FC4E2A', '#E31A1C', '#BD0026', '#800026']);

var projection = new BMap.MercatorProjection();
var resolutions = [];
for(var i=0; i<18; i++){
    resolutions[i] = Math.pow(2, 18-i);
}

// 定义瓦片坐标系
var tilegrid  = new ol.tilegrid.TileGrid({
    origin: [0,0],
    resolutions: resolutions
});

// 创建百度地图的数据源
var baidu_source = new ol.source.TileImage({
    projection: projection,
    tileGrid: tilegrid,
    
    tileUrlFunction: function(tileCoord, pixelRatio, proj){
        if(!tileCoord){
            return "";
        }
        var z = tileCoord[0];
        var x = tileCoord[1];
        var y = tileCoord[2];

        // 百度瓦片服务url将负数使用M前缀来标识
        if(x<0){
            x = "M"+(-x);
        }
        if(y<0){
            y = "M"+(-y);
        }

        return "http://online3.map.bdimg.com/onlinelabel/?qt=tile&x="+x+"&y="+y+"&z="+z+"&styles=pl&udt=20171021&scaler=1&p=1";
    }
});

var baidu_layer = new ol.layer.Tile({
    source: baidu_source
});

var point = projection.lngLatToPoint(new BMap.Point(116.403963,39.915119));
var map = new ol.Map({
    target: 'map',
    layers: [baidu_layer],
    view: new ol.View({
        center:  [point.x, point.y],
        zoom: 10,
        minZoom: 9,
        maxZoom: 18
    }),
    interactions: ol.interaction.defaults({
        doubleClickZoom: false,
        PinchZoom: false,
        shiftDragZoom: false,
        PinchRotate: false,
        DragRotate: false
    })
});


var live100, live200, live500, live1000, work100, work200, work500, work1000;
d3.queue()
    .defer(d3.json, 'data/beijing_live_201706_100m.json')
    .defer(d3.json, 'data/beijing_live_201706_200m.json')
    .defer(d3.json, 'data/beijing_live_201706_500m.json')
    .defer(d3.json, 'data/beijing_live_201706_1000m.json')
    .defer(d3.json, 'data/beijing_work_201706_100m.json')
    .defer(d3.json, 'data/beijing_work_201706_200m.json')
    .defer(d3.json, 'data/beijing_work_201706_500m.json')
    .defer(d3.json, 'data/beijing_work_201706_1000m.json')
    .await(function(error, live_100, live_200, live_500, live_1000, work_100, work_200, work_500, work_1000){
        live100=live_100;
        live200=live_200;
        live500=live_500;
        live1000=live_1000;
        work100=work_100;
        work200=work_200;
        work500=work_500;
        work1000=work_1000;
        //***************** init ********************//
        updateVis (work1000,1000);
        //************** 监听移动事件 *****************//
        map.on ('moveend', function(event){
            updateVis (null, null, true);
        });
});


// selectVis()
//**************function update Vis *************//
var gridLayer, gridSelect;

function updateVis (dataName=null, Len=null, ismove=false){

    if (dataName === null) {
        visData = preVisData
    } else {
        visData = dataName;
        preVisData = dataName; 
    }
    if (Len === null) {
        gridLen = preGridLen;
    } else {
        gridLen = Len;
        preGridLen = Len; 
    }

    population=0;
    d3.select('.info span').text(numberFormat(population));
    // console.log("population-",population);

    ////////////////////////////// define color domain ///////////////////////////////////
    var maxValue = d3.max(visData, function(d){ return +d.count; });
    colorScale.domain([0, maxValue]);
    console.log(maxValue);
    createLegend(colorScale,maxValue)

    map.removeLayer(gridLayer);
    map.removeInteraction(gridSelect);
    ///////////////////////////////// processing data ////////////////////////////////////
    // get scope of current screen
    var boundMct = map.getView().calculateExtent(map.getSize());
    var boundWn = projection.pointToLngLat(new BMap.Pixel(boundMct[0],boundMct[1])); 
    var boundEs = projection.pointToLngLat(new BMap.Pixel(boundMct[2],boundMct[3]));   
    // console.log(boundWn,boundEs)  

    // bind data to basegeojson
    var geojson = gridGeojson(visData, 'lng', 'lat');
    // console.log(geojson)

    // Create vector base station from GeoJSON
    var grid = new ol.source.Vector({
        features: (new ol.format.GeoJSON()).readFeatures(geojson),
        attributions: [new ol.Attribution({
            // html: '<a href="http://ssb.no/">SSB</a>'
        })]
    });

    // Create base style function
    var gridStyle = function (feature,resolution) {
        var coordinate = feature.getGeometry().getCoordinates(),
            x = coordinate[0],
            y = coordinate[1],
            pop = parseInt(feature.getProperties().count),
            rgb = d3.rgb(colorScale(pop));
        // console.log(x,y,y + gridLen)

        return [
            new ol.style.Style({
                fill: new ol.style.Fill({
                    color:[rgb.r, rgb.g, rgb.b, 0.6]
                }),
                geometry: new ol.geom.Polygon([[
                    [x,y], [x, y + gridLen*1.3], [x + gridLen*1.327, y + gridLen*1.3], [x + gridLen*1.327, y]
                ]])
            })
        ];
    };

    // Create base selection style function
    var gridSelectStyle = function (feature, resolution) {
        var coordinate = feature.getGeometry().getCoordinates(),
            x = coordinate[0],
            y = coordinate[1],
            pop = parseInt(feature.getProperties().count),
            rgb = d3.rgb(colorScale(pop));

        return [
            new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: '#333',
                    width: 10 / resolution
                }),
                fill: new ol.style.Fill({
                    color:[rgb.r, rgb.g, rgb.b, 0.6]
                }),
                geometry: new ol.geom.Polygon([[
                    [x,y], [x, y + gridLen], [x + gridLen, y + gridLen], [x + gridLen, y]
                ]])
            })
        ];
    };

    
    // Create layer form vector grid and style function
    gridLayer = new ol.layer.Vector({
        source: grid,
        style: gridStyle
    });

    // Add base layer to map
    map.addLayer(gridLayer);

    // Create base select interaction
    gridSelect = new ol.interaction.Select({
        style: gridSelectStyle
    });

    // Get selected base cells collection
    var selectedGrid = gridSelect.getFeatures();
    
    selectedGrid.on('add', function (feature) {
        population += parseInt(feature.element.getProperties().count);
        lng = feature.element.getProperties().lng;
        lat = feature.element.getProperties().lat;
        showGrid(population,lng,lat);
    });

    selectedGrid.on('remove', function (feature) {
        population -= parseInt(feature.element.getProperties().count);
        showGrid(population,lng,lat);
    });


    // Add select interaction to map
    map.addInteraction(gridSelect);

    var draw = new ol.interaction.Draw({
        type: 'Polygon'
    });

    draw.on('drawstart', function (evt) {
        selectedGrid.clear();
    });

    draw.on('drawend', function (evt) {
        var geometry = evt.feature.getGeometry(),
            extent = geometry.getExtent(),
            drawCoords = geometry.getCoordinates()[0];

        map.removeInteraction(draw);
        d3.select('.info .intro').style('display', 'block');
        d3.select('.info .select').style('display', 'none');

        grid.forEachFeatureIntersectingExtent(extent, function(feature) {
            if (pointInPolygon(feature.getGeometry().getCoordinates(), drawCoords)) {
                selectedGrid.push(feature);
            }
        });

        setTimeout(function(){ // Add delay to avoid deselect
            gridSelect.setActive(true);
        }, 500);
    });

    d3.select('.info a').on('click', function(){
        d3.event.preventDefault();
        selectedGrid.clear();
        gridSelect.setActive(false);
        map.addInteraction(draw);
        d3.selectAll('.info .intro').style('display', 'none');
        d3.select('.info .select').style('display', 'block');
    });
}


function showGrid (population,lng,lat) {
    d3.select('.info span').text(numberFormat(population));
}

// Convert SSBgrid data to GeoJSON
function gridGeojson (data, lng, lat) {
    var points = {
        type: 'FeatureCollection',
        features: []
    };

    data.forEach(function(d){
        var center= projection.lngLatToPoint(new BMap.Point(+d[lng], +d[lat]));
        //console.log(+d[BAIDUX], +d[BAIDUY], center)

        points.features.push({
            type: 'Feature',
            properties: d,
            geometry: {
                type: 'Point',
                coordinates: [center.x,center.y]
            }
        });
    });

    return points;
};

function pointInPolygon (point, vs) {
    var x = point[0], y = point[1];

    var inside = false;
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        var xi = vs[i][0], yi = vs[i][1];
        var xj = vs[j][0], yj = vs[j][1];

        var intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }

    return inside;
}

// Based on http://bl.ocks.org/mbostock/4573883
function createLegend (colorScale,maxValue) {
    var x = d3.scaleLinear()
        .domain([0, maxValue])
        .range([0, 300]);

    var tickValue = colorScale.range().map(function(color) {
            var d = colorScale.invertExtent(color)[0];
            return d; 
        });
    // console.log(tickValue.filter(function(d) {return d >0}));

    var xAxis = d3.axisBottom(x)
        .tickSize(14)
        .tickValues(tickValue.filter(function(d) {return d >0}));


    var svg = d3.select('svg.legend');

    svg.selectAll('rect')
        .data(colorScale.range().map(function(color) {
            var d = colorScale.invertExtent(color);
            if (d[0] == null) d[0] = x.domain()[0];
            if (d[1] == null) d[1] = x.domain()[1];
            return d;
        }))
        .enter().append('rect')
        .attr('height', 10)
        .attr("x", function(d) { return x(d[0]); })
        .attr('width', function(d) { return x(d[1]) - x(d[0]); })
        .style('fill', function(d) { return colorScale(d[0]); });

    svg.call(xAxis);
}


function selectVis () {
    var select1 = document.getElementById("controlGrid");
    var optionGrid = [];
    for(var i=0;i<select1.length;i++){
        if(select1.options[i].selected){
            optionGrid.push(select1[i].value);
        }
    }
    var select2 = document.getElementById("controlType");
    var optionType = [];
    for(var i=0;i<select2.length;i++){
        if(select2.options[i].selected){
            optionType.push(select2[i].value);
        }
    }
    if (optionType[0]==="work") {
        if (optionGrid[0]==="100") {
            updateVis (work100,100);
        } else if (optionGrid[0]==="200") {
            updateVis (work200,200);
        } else if (optionGrid[0]==="500") {
            updateVis (work500,500);
        } else {
            updateVis (work1000,1000);
        } 
    } else {
        if (optionGrid[0]==="100") {
            updateVis (live100,100);
        } else if (optionGrid[0]==="200") {
            updateVis (live200,200);
        } else if (optionGrid[0]==="500") {
            updateVis (live500,500);
        } else {
            updateVis (live1000,1000);
        } 
    }
    // console.log(optionGrid,optionType)
}   
