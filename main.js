let canvas;
let gl;
let program;

let pointsColors = []
let points = [];
let colors = [];
let viewAspect = [];

let theta = 0;
let alphaX = 0;
let alphaY = 0;
let alphaScale = 1;

let tMatrixLoc;
let rMatrixLoc;
let sMatrixLoc;
let oMatrixLoc;

let clickStart = -1;
let clickEnd;
let clicking = false;
let clickLocX;
let clickLocY;
let shiftClicked = false;

function main()
{
    //Starter
    canvas = document.getElementById('webgl');
    gl = WebGLUtils.setupWebGL(canvas, undefined);
    if (!gl)
    {
        console.log('Failed to get the rendering context for WebGL');
        return;
    }
    program = initShaders(gl, "vshader", "fshader");
    gl.useProgram(program);
    gl.viewport(0, 0, canvas.width, canvas.height);

    //Uniform matrix locations
    tMatrixLoc = gl.getUniformLocation(program, 'tMatrix')
    rMatrixLoc = gl.getUniformLocation(program, 'rMatrix')
    sMatrixLoc = gl.getUniformLocation(program, 'sMatrix')
    oMatrixLoc = gl.getUniformLocation(program, 'oMatrix')

    //listeners
    document.getElementById('files').addEventListener('change', svgData);
    document.addEventListener('keypress', keyPressed);
    window.addEventListener('wheel', scrolling);
    canvas.addEventListener('mousedown', clickDown);
    canvas.addEventListener('mousemove', dragging);
    canvas.addEventListener('mouseup', clickUp);
}

//Required method
function render() {
    let vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);

    let vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    let cBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);

    let vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    alterViewAspect();
    let tMatrix = translate(viewAspect[2]/2 + viewAspect[0] + alphaX, viewAspect[3]/2 + viewAspect[1] + alphaY, 0);
    let rMatrix = rotateZ(theta);
    let sMatrix = scalem(alphaScale, alphaScale, 1);
    let oMatrix = translate(-viewAspect[2]/2 - viewAspect[0],-viewAspect[3]/2 - viewAspect[1],0);

    gl.uniformMatrix4fv(tMatrixLoc, false, flatten(tMatrix));
    gl.uniformMatrix4fv(rMatrixLoc, false, flatten(rMatrix));
    gl.uniformMatrix4fv(sMatrixLoc, false, flatten(sMatrix));
    gl.uniformMatrix4fv(oMatrixLoc, false, flatten(oMatrix));

    let pMatrix = ortho(viewAspect[0], viewAspect[0]+viewAspect[2],viewAspect[1]+viewAspect[3],viewAspect[1], -10, 10);
    let pMatrixLoc = gl.getUniformLocation(program, 'pMatrix');
    gl.uniformMatrix4fv(pMatrixLoc, false, flatten(pMatrix));

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.LINES, 0, points.length);

    requestAnimationFrame(render);
}

//Method to get usable data from imported svg file
function svgData(event){
    resetCanvas();
    gl.clear(gl.COLOR_BUFFER_BIT);
    let xml;
    let dom_parser;
    let reader = readTextFile(event);
    reader.onload = () => {
        //resetTransform();
        //Parse svg
        dom_parser = new DOMParser();
        xml = dom_parser.parseFromString(reader.result, "image/svg+xml");

        //Built-in method to read from xml into usable format
        pointsColors = xmlGetLines(xml, vec4(0.0,0.0,0.0,1.0)); //pointsColors contains 2 arrays

        //Splits into points and colors array
        for(let i = 0; i < pointsColors[0].length; i++){
            //First array contains coordinates of points
            console.log(vec4(pointsColors[0][i][0], pointsColors[0][i][1], 0, 1))
            points.push(vec4(pointsColors[0][i][0], pointsColors[0][i][1], 0, 1));
            //Second array contains colors of points
            colors.push(vec4(pointsColors[1][i]));
        }

        //Built-in function to get array of viewbox dimensions of xml file
        viewAspect = xmlGetViewbox(xml, vec4(0,0,400,400));
        render();
    }
}

//set view to aspect ratio of image to keep the image from distorting
function alterViewAspect(){
    //Scale viewport if height is greater than width
    if(viewAspect[2] > viewAspect[3]){
        gl.viewport(0,0,400,viewAspect[3]*400/viewAspect[2]);
    }
    //Scale viewport if width is greater than height
    else{
        gl.viewport(0,0,viewAspect[2]*400/viewAspect[3],400);
    }
}

//Reset transformations when r is pressed
function keyPressed(event){
    if(event.key === "r"){
        reset();
    }
}

//When mouse is pressed
function clickDown(event){
    //Variable to catch if dragging
    clicking = true;

    //If first click in sequence to create line
    if (clickStart === -1){
        clickStart = new Date().getTime();
        clickLocX = event.clientX;
        clickLocY = event.clientY;
    }
    //If second click in sequence of creating a line
    else{
        //Ensure it was a click not a drag
        if((clickEnd - clickStart) < 1000) {
            //Push points + colors with weird transformations to try to get close to where was clicked
            points.push(vec4((clickLocX - 500) * (viewAspect[2] / canvas.width), (clickLocY - 70)  * (viewAspect[3] / canvas.height), 0, 1));
            points.push(vec4((event.clientX - 500) * (viewAspect[2] / canvas.width), (event.clientY - 70) * (viewAspect[3] / canvas.height), 0, 1));
            colors.push(vec4(0, 0, 0, 1));
            colors.push(vec4(0, 0, 0, 1));

            //reset to first click
            clickStart = -1;

            //draw line
            render();
        }
    }
}

//If the mouse is clicked and dragging
function dragging(event) {
    if(clicking){
        //adds correct movement to translation matrix
        alphaX += event.movementX * (viewAspect[2]/canvas.width);
        alphaY += event.movementY * (viewAspect[3]/canvas.height);
    }
}

//Indicates when mouse is complete being clicked
function clickUp(event){
    //Used to make sure dragging is complete
    clicking = false;

    //Used to check if click or drag
    clickEnd = new Date().getTime();
}

//When user is scrolling
function scrolling(event){
    //If shift is being clicked
    if(event.shiftKey){
        //adds values to scaling matrix
        alphaScale += event.deltaY;

        //keeps within range
        if (alphaScale < 0.1) {
            alphaScale = 0.1;
        } else if (alphaScale > 10) {
            alphaScale = 10;
        }
    }

    //adds value to rotation matrix
    else{
        theta += event.deltaY;
    }
}

//Resets drawing when new image is rendered
function resetCanvas(){
    gl.clear(gl.COLOR_BUFFER_BIT);
    pointsColors = [];
    points = [];
    colors = [];
}

//resets all transformation variables
function reset(){
    theta = 0;
    alphaX = 0;
    alphaY = 0;
    alphaScale = 1;
}


