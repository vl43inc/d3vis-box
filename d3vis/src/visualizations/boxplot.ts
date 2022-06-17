import { Looker, VisualizationDefinition } from '../common/types';

import { handleErrors } from '../common/utils';
import * as d3 from 'd3'
import { deepStrictEqual, strict as assert } from 'assert';



declare var looker: Looker;



interface Boxplot extends VisualizationDefinition {

    elementRef?: HTMLDivElement,

}



const vis: Boxplot = {

    id: 'boxplot', // id/label not required, but nice for testing and keeping manifests in sync

    label: 'boxplot',

    options: {

        yMin: {

             type: 'string',

             label: 'Minimum Y Value',

             values: [
                {"Zero": "0"}, 
                {"Minimum Measurement": 'min'}
            ],

            display: 'radio',

            default: '0'

        }

    },

    // Set up the initial state of the visualization

    create(element, config) {

        this.elementRef = element;

    },

    // Render in response to the data or settings changing

    update(data, element, config, queryResponse) {

        console.log( 'data (whole array)', data);

        console.log( 'element', element );

        console.log( 'config', config );

        console.log( 'queryResponse', queryResponse );

        const errors = handleErrors(this, queryResponse, {

            // min_pivots: 0,

            // max_pivots: 0,

            // min_dimensions: 1,

            // max_dimensions: 1,

            // min_measures: 1,

            // max_measures: 1

        });

        if (errors) { // errors === true means no errors
            const colors = ['#015836', '#33658A', '#86BBD8', '#779B59', '#A7C957', '#F8BD4F', '#C76228','#8C4843', '#9E643C', '#AF929D']
            const allFields = queryResponse.fields.dimensions.map((dim)=> dim.name)
            const allFieldsLabel = queryResponse.fields.dimensions.map((dim)=> dim.label_short)
            console.log("allFields", allFields) //gets names of each field
            const formattedData = new Map()
            for (const field of allFields){
                formattedData.set(field, data.map(elem => elem[field].value))
            }
            console.log("formattedData", formattedData) //map of data field name to array of data
            
            //calculate standard dev

            const width = element.clientWidth
            const height = element.clientHeight
            

            // TODO: get rid of magic numbers   
            const quantitative: string = allFields[2] //should make this adjustable? in options assumes second column is categorical, third is quantitative
            const categorical: string = allFields[1]
            element.innerHTML = ``; //not sure why I need this but if I remove it then it doesn't work
            const numberData = formattedData.get(quantitative)
            const categoricalData = formattedData.get(categorical)
            const categoricalUnique = [...new Set(formattedData.get(categorical))]
            const bounds = [];
            let colorIndex = 0
            for (const catName of categoricalUnique){
                const color = colors[colorIndex];
                let catData = []
                for (let i=0; i<numberData.length; i++){
                    if (categoricalData[i] === catName){
                        catData.push(numberData[i])
                    }
                }
                const sorted_data = catData.sort(d3.ascending)
                const n = sorted_data.length
                const q1 = d3.quantile(sorted_data, 0.25)
                const median = d3.quantile(sorted_data, 0.5)                
                const q3 = d3.quantile(sorted_data, 0.75)
                const max = d3.max(sorted_data)
                const min = d3.min(sorted_data)
                bounds.push({category:catName, median: median, q1:q1, q3:q3, min:min, max:max, n:n, color:color})
                colorIndex = (colorIndex +1)%colors.length
            }
            console.log("bounds", bounds)
            console.log(categoricalUnique)
            console.log("numberData", numberData)

            //make svg and tooltip
            const svg = d3.select(element).append('svg').attr('width', width).attr('height', height)
            const tooltip = d3.select(element).append('div')
            .attr('id', 'tooltip')
            .attr('style', 'position: absolute; opacity: 0;')
            .style("background-color", "white")
            .style("border", "solid")
            .style("border-width", "1px")
            .style("border-radius", "5px")
            .style('font', '12px times')
            .style("padding", "10px")

            //make axes labels
            svg.append("text")
            .attr("class", "x label")
            .attr("text-anchor", "end")
            .attr("x", width)
            .attr("y", height-6)
            .text(allFieldsLabel[1])
            .style("padding", "10px");

            svg.append("text")
            .attr("class", "y label")
            .attr("text-anchor", "end")
            .attr("y", 6)
            .attr("dy", ".75em")
            .attr("transform", "rotate(-90)")
            .text(allFieldsLabel[2])


            const widthMargin = 30;
            const heightMargin = 40;
            const g = svg.append('g')

            let yMin = 0
            if (config.yMin === 'min') yMin = d3.min(numberData);
            // Create scale
            const yscale = d3.scaleLinear()
            .domain([yMin, d3.max(numberData)])
            .range([height-heightMargin, 0]);

            // Add scales to axis
            let y_axis = d3.axisLeft()
                .scale(yscale);

            let xScale = d3.scaleBand().range ([0, width-widthMargin]).domain(categoricalUnique.map((c)=> c)).padding(0.4)
            let x_axis = d3.axisBottom().scale(xScale)
            //var color = d3.scale.ordinal().range([0, width-margin]).domain(['#015836', '#33658A', '#86BBD8', '#779B59', '#A7C957', '#F8BD4F', '#C76228','#8C4843', '#9E643C', '#AF929D']);
            
            //Append group and insert axis
            g.append("g")
            .attr("transform", "translate(50, 0)")
            .call(y_axis);

            g.append("g")
            .attr("transform", "translate(50, "+(height - heightMargin)+")")
            .call(x_axis);

            
            //create functions for hover tooltip
            const mouseover = (event, d) => {
                console.log('pagex', event.pageX)
                tooltip.style("opacity", 1);
                console.log("made it to here")
              };
        
              const mouseleave = (event, d) => {
                tooltip.style('opacity', 0);
              }
        
              const mousemove = (event, d) => {
                console.log("this is working")
                tooltip.html(`Num Measurements: ${d.n}`+ "<br/>" + `Median: ${Math.round(d.median*100)/100}`);
                d3.select('#tooltip')
                .style('left', (event.pageX+10) + 'px')
                .style('top', (event.pageY+10) + 'px')
                }

            //make bar graphs
            g.selectAll(".bar")
            .data(bounds)
            .enter().append("rect")
            .attr("class", "bar")
            .attr("x", function(d) { return xScale(d.category)+50; })
            .attr("y", function(d) { return yscale(d.q3); })
            .attr("width", xScale.bandwidth())
            .attr("height", function(d) { return height - heightMargin - yscale(d.q3-d.q1 + yMin); })
            .attr("fill", function(d) {return d.color})
            // .style("background-color", function(d, i) {
            //     return color(i);})
            .on('mousemove', mousemove)
            .on('mouseover', mouseover)
            .on('mouseleave', mouseleave)

            g
            .selectAll("medianLines")
            .data(bounds)
            .enter()
            .append("line")
            .attr("x1", function(d){return xScale(d.category)+50;})
            .attr("x2", function(d){return xScale(d.category) + xScale.bandwidth() +50;})
            .attr("y1", function(d){return yscale(d.median)})
            .attr("y2", function(d){return yscale(d.median)})
            .attr("stroke", "black")
            .style("width", 100)

            g
            .selectAll("topWhisker")
            .data(bounds)
            .enter()
            .append("line")
            .attr("x1", function(d){return xScale(d.category)+50 + xScale.bandwidth()/2})
            .attr("x2", function(d){return xScale(d.category)+50  + xScale.bandwidth()/2;})
            .attr("y1", function(d){return yscale(d.max)})
            .attr("y2", function(d){return yscale(d.q3)})
            .attr("stroke", "black")
            .style("width", 100)


            g
            .selectAll("bottomWhisker")
            .data(bounds)
            .enter()
            .append("line")
            .attr("x1", function(d){return xScale(d.category)+50 + xScale.bandwidth()/2})
            .attr("x2", function(d){return xScale(d.category)+50  + xScale.bandwidth()/2;})
            .attr("y1", function(d){return yscale(d.q1)})
            .attr("y2", function(d){return yscale(d.min)})
            .attr("stroke", "black")
            .style("width", 100)

        }

    }

};



looker.plugins.visualizations.add(vis);