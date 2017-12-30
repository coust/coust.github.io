'use strict';

var readMode = false,
    color = 0,
    courseColor = [],
    terms = "", // store terms info
    data = "", // data get from courseInfo.json (via data.php and .json updated by mkdata.php)
    loaded = false, // check if data loaded when adding course
    searchhints = [],
    semester = null, // store term in use
    timetable = []; // store the timetable

var HTTP_PATH = 'https://coust.442.hk/';
var COOKIE_EXPIRE_DAYS = 50;

function getSections(code) {
    if (!loaded) {
        return null;
    }
    if (!data.hasOwnProperty(code)) {
        return null;
    }
    var course = data[code];
    var sections = course["sections"];
    var types = {};
    for (var i = 0; i < sections.length; i++) {
        var type = sections[i]["section"].match(/[A-Za-z]+/i);
        if (typeof types[type] === "undefined") {
            types[type] = [];
        }
        var duplicate = false;
        for (var j = 0; j < types[type].length; j++) {
            if (sections[i]["section"] === types[type][j]) {
                duplicate = true;
            }
        }
        if (!duplicate) {
            types[type].push(sections[i]["section"]);
        }
    }
    var keys = [];
    for (var k in types) {
        keys.push(k);
    }
    types["types"] = keys;
    return types;
}

function getSectionObjs(code, section) {
    var objs = [];
    for (var j = 0; j < data[code]["sections"].length; j++) {
        if (data[code]["sections"][j]["section"] === section) {
            objs.push(data[code]["sections"][j]);
        }
    }
    return objs;
}

function addCourse(_code, sections) {
    if (!loaded) {
        console.log("Please try again later as data is still loading...");
        return false;
    }
    var val = $("#add").val().trim();
    if (typeof _code !== "") {
        val = _code;
    }
    var code = val.split(" ")[0].trim();
    code = code.substr(0, code.length - 1);
    if (val === "") {
        console.log("No course code");
        return false;
    }
    else if (!data.hasOwnProperty(code)) {
        console.log("Course not found: " + code);
        return false;
    }
    if (timetable.hasOwnProperty(code)) {
        alert("Course already added!");
        return false;
    }
    timetable[code] = [];
    var course = data[code];
    // remove from search hints of autocomplete
    var hintstext = code + ": " + course["name"];
    for (var i = 0; i < searchhints.length;) {
        if (searchhints[i] == hintstext) {
            searchhints.splice(i, 1);
            break;
        }
        else {
            i++;
        }
    }
    var types = getSections(code);
    if (sections === "") {
        for (var i = 0; i < types["types"].length; i++) {
            // add the first section of each section type
            var type = types["types"][i];
            var section = types[type][0];
            var section_singleton = (types[type].length === 1);
            addSection(course, section, section_singleton, false);
        }
    }
    else {
        for (var i = 0; i < sections.length; i++) {
            var section_singleton = (types[sections[i].match(/[A-Z]+/i)].length === 1);
            addSection(course, sections[i], section_singleton, false);
        }
    }
    // add to timetable control table, hide the no courses added row
    $("#none").hide();
    var infolink = "https://w5.ab.ust.hk/wcq/cgi-bin/" + terms[0]["num"] + "/subject/" + code.substr(0, 4) + "#" + code;
    var actions = "<a target='_blank' href='" + infolink + "'><img title='Details' class='actionsImg' src='images/info.png' /></a>&nbsp;&nbsp;";
    actions += "<a href='javascript:removeCourse(\"" + code + "\")'><img title='Remove' class='actionsImg' src='images/cross.png' /></a>";
    var htmlrow = "<tr class='color" + color + " " + code + "' name='" + code + "'><td>" + code + "</td><td>" + data[code]["name"] + "</td><td>" + actions + "</td></tr>";
    $("#courselist").children("tr").each(function () {
        if (htmlrow !== null && code < $(this).attr("name")) {
            $(htmlrow).insertBefore($(this));
            htmlrow = null;
        }
    });
    if (htmlrow !== null) {
        $("#courselist").append(htmlrow);
    }
    courseColor[code] = color;
    // change color;
    color = (color + 1) % 10;
    $("#add").val(""); // clear input text
    getURL();
    return false; // always return false to avoid form submitting
}

// course: course object, section: section number, singleton: boolean
function addSection(course, section, singleton, virtual) {
    var code = course["code"];
    if (!virtual) timetable[code].push(section);
    var sectionObjs = getSectionObjs(code, section);
    var timeStr = "";
    var dates = null, weekdays = null, times = null;
    for (var s = 0; s < sectionObjs.length; s++) {
        var datetime = sectionObjs[s]["datetime"];
        var hasDate = 0;
        if (datetime.length === 2) hasDate = 1;
        if (hasDate === 1) {
            dates = datetime[0].match(/[0-9]{2}-[A-Z]{3}-[0-9]{4}/ig);
            dates['index'] = s;
            if (sectionObjs.length > 1)
                dates['multiple'] = true;
            else
                dates['multiple'] = false;
        }
        if (datetime[0] === "TBA") { // TBA cannot be added into timetable
            var str = "<span class='tba " + code + " " + section + "'>";
            if (!virtual) {
                if ($("#no-tba").is(':hidden')) str += ', ';
                str += course.code + " " + section + "</span>";
                $("#tba-courses").append(str);
                $("#no-tba").hide();
            }
            // save timetable to cookies
            saveTimetableToStorage();
            getURL();
            continue;
        }
        weekdays = datetime[hasDate].match(/(Mo|Tu|We|Th|Fr|Sa|Su)/ig);
        times = datetime[hasDate].match(/[0-9]{2}:[0-9]{2}[A|P]M/ig);
        /*if (!times || times.length!==2) {
         // the element is date rather than time
         //continue;
         }
         else if (timeStr.indexOf(times)!==-1) {
         // duplicate time (may be of different date period)
         //continue;
         }*/
        timeStr += times;
        if (dates !== null && dates.length === 2) {
            timeStr = dates[0] + " - " + dates[1] + " " + timeStr;
        }
        for (var k = 0; k < weekdays.length; k++) {
            addCourseBox(code, section, weekdays[k], times[0], times[1], singleton, virtual, dates, sectionObjs[s]);
        }
    }
}

// create the course box in timetable
function addCourseBox(code, section, weekday, start, end, singleton, virtual, dates, sectionObj) {
    if ($("#" + weekday).hasClass("hidden")) {
        $("#" + weekday).removeClass("hidden");
    }
    var colorText = "color" + color;
    var draggable = "";
    if (!singleton) {
        draggable = "draggable";
    }
    var virtualbox = "real";
    if (virtual) {
        virtualbox = "virtual";
        colorText = $("div.lesson.real." + code).attr("class").match(/color[0-9]+/i);
    }
    if (courseColor.hasOwnProperty(code)) {
        colorText = "color" + courseColor[code];
    }
    var title = start + " - " + end;
    var datePeriodText = "", dateInfo = "";
    var NEWLINE = "&#10;";
    if (dates) {
        title = dates[0] + " - " + dates[1] + NEWLINE + title;
        if (dates['multiple']) datePeriodText = " [" + dates['index'] + "]";
        dateInfo = "datestart='" + dates[0] + "' dateend='" + dates[1] + "'";
    }
    else {
        dateInfo = "datestart='' dateend=''";
    }
    dateInfo = dateInfo.replace("-", " ");
    var room = sectionObj["room"];
    if (room == "TBA") room = "Rm: TBA";
    var roomShort = room.replace(/, Lift [0-9]+((-|,)( )*[0-9]+)?/gi, "");
    roomShort = roomShort.replace(/\([0-9]+\)/gi, "");
    roomShort = roomShort.replace(/Lecture Theater /gi, "LT");
    roomShort = roomShort.replace(/, [A-Z ]+/gi, "");
    title += NEWLINE + room + NEWLINE + "Instructor: ";
    if (sectionObj["instructor"].length === 0) sectionObj["instructor"].push("TBA");
    if (sectionObj["instructor"].length === 1) title += sectionObj["instructor"][0];
    else for (var instr = 0; instr < sectionObj["instructor"].length; instr++) {
        title += NEWLINE + " - " + sectionObj["instructor"][instr];
    }
    var htmldiv = "<div " + dateInfo + " title='" + title + "' name='" + code + "_" + section + "' class='" + colorText + " lesson " + draggable + " " + virtualbox + " " + code + " " + section + "'><div>" + code + "<br/>" + section + datePeriodText + "<br/>" + roomShort + "</div></div>";
    var start_time = parseInt(start.substr(0, 2).concat(start.substr(3, 2)), 10);
    if (start.substr(5, 2) === "PM" && start.substr(0, 2) !== "12") {
        start_time += 1200;
    }
    var end_time = parseInt(end.substr(0, 2) + end.substr(3, 2), 10);
    if (end.substr(5, 2) === "PM" && end.substr(0, 2) !== "12") {
        end_time += 1200;
    }
    var starth = Math.floor(start_time / 100);
    var startm = start_time % 100;
    var endh = Math.floor(end_time / 100);
    var endm = end_time % 100;
    var h = "h".concat((starth < 10) ? ("0".concat(starth)) : starth);
    var tmp = Math.ceil(startm / 30) * 30 % 60;
    var m = "m".concat(tmp < 10 ? "0".concat(tmp) : tmp);
    var spancount = Math.ceil((endh * 60 + endm - starth * 60 - startm) / 30);
    var added = false;
    var hasConflict = false;
    $("#" + weekday).children("tr").each(function () {
        if (added) return false; // break the loop
        var cell = $(this).children("td." + h + "." + m).eq(0);
        if ($(cell).hasClass("occupied") || $(cell).hasClass("hidden")) {
            // skip this row as the cell is being ocuppied
            hasConflict = true;
        }
        else {
            // check if all cells needed are available
            var avail = true;
            var nextcell = $(cell).next();
            for (var i = 1; i < spancount; i++) {
                if ($(nextcell).hasClass("occupied") || $(nextcell).hasClass("hidden")) {
                    avail = false;
                }
                nextcell = $(nextcell).next();
            }
            // add the course box if all cells available
            if (avail) {
                $(cell).append(htmldiv);
                $(cell).addClass("occupied");
                $(cell).attr("colspan", spancount);
                // hide the next few cells
                var next = $(cell).next();
                for (var i = 1; i < spancount; i++) {
                    $(next).addClass("hidden");
                    next = $(next).next();
                }
                added = true;
                if (!virtual) {
                    // atach jQuery draggable
                    if (!singleton) {
                        var realcell = $("div.lesson.real." + code + "." + section);
                        $(realcell).draggable({
                            appendTo: "body",
                            helper: "clone",
                            start: function (event, ui) {
                                var lessontd = $(realcell).eq(0).parentsUntil("td").parent();
                                var lessondiv = $(realcell).eq(0);
                                if (!$("#timetable_wrapper").hasClass("vertical-timetable")) {
                                    $(ui.helper).css("width", $(lessondiv).outerWidth());
                                    $(ui.helper).css("height", $(lessondiv).outerHeight());
                                }
                                else {
                                    $(ui.helper).css("width", $(lessondiv).outerHeight());
                                    $(ui.helper).css("height", $(lessondiv).outerWidth());
                                }
                                $(ui.helper).addClass("move");
                                $(ui.helper).removeAttr("title");
                                addVirtualCourse(code, section);
                            },
                            stop: function (event, ui) {
                                if ($("div.lesson.toadd." + code).length > 0) {
                                    var new_section = $("div.lesson.toadd." + code).eq(0).attr("name").split("_")[1];
                                    // remove virtual class of new section
                                    //$("div.lesson.virtual."+code+"."+new_section).removeClass("virtual").addClass("real").addClass("toadd");
                                    // remove virtual sections
                                    removeVirtualCourse(code);
                                    // remove orginal section
                                    removeSection(code, section);
                                    // add new section
                                    addSection(data[code], new_section, singleton, false);
                                }
                                else {
                                    removeVirtualCourse(code);
                                }
                            }
                        });
                    }
                }
                else { // virtual
                    // attach jQuery droppable
                    var $virtualcell = $("div.lesson.virtual." + code + "." + section);
                    $virtualcell.droppable({
                        drop: function () {
                            // drop() of droppable fires before stop() of draggable
                            $virtualcell.addClass("toadd");
                            $virtualcell.removeClass("virtual-hover");
                        },
                        over: function (event, ui) {
                            $virtualcell.addClass("virtual-hover");
                            console.info("Event: ", {clientX: event['clientX'], clientY: event['clientY']}, "UI: ", ui['offset']);
                        },
                        out: function (event, ui) {
                            $virtualcell.removeClass("virtual-hover");
                        }
                    });
                }
            }
            // else look for next row
            else { // avail == false
                hasConflict = true;
            }
        }
    });
    // if no current existing rows available, create a new row
    if (!added) {
        // increase rowspan of weekday header
        var newrowspan = parseInt($("#" + weekday + " th").attr("rowspan"), 10) + 1;
        $("#" + weekday + " th").attr("rowspan", newrowspan);
        var htmlrow = '<tr><td class="h09 m00"></td><td class="h09 m30"></td><td class="h10 m00"></td><td class="h10 m30"></td><td class="h11 m00"></td><td class="h11 m30"></td><td class="h12 m00"></td><td class="h12 m30"></td><td class="h13 m00"></td><td class="h13 m30"></td><td class="h14 m00"></td><td class="h14 m30"></td><td class="h15 m00"></td><td class="h15 m30"></td><td class="h16 m00"></td><td class="h16 m30"></td><td class="h17 m00"></td><td class="h17 m30"></td><td class="h18 m00"></td><td class="h18 m30"></td><td class="h19 m00"></td><td class="h19 m30"></td><td class="h20 m00"></td><td class="h20 m30"></td><td class="h21 m00"></td><td class="h21 m30"></td><td class="h22 m00"></td><td class="h22 m30"></td></tr>';
        $("#" + weekday).append(htmlrow);
        addCourseBox(code, section, weekday, start, end, singleton, virtual, dates, sectionObj);
        return;
    }
    if (hasConflict) setTimeConflict(weekday, start, end);
    $("div.lesson." + code).parentsUntil("tr").parent().removeClass("spare-tr");
    // save timetable to cookies
    saveTimetableToStorage();
    getURL();
    updateConflictStyle();
    if (readMode) $(".lesson.draggable").draggable("disable");
}

// remove course from timetable and control table
function removeCourse(code) {
    if (readMode) {
        alert("Not allowed in Read-Only Mode");
        return;
    }
    $(".tba." + code).remove();
    if ($("#tba-courses").children().length === 0) {
        $("#no-tba").show();
    }
    $("td.occupied div.lesson." + code).each(function () {
        var cell = $(this).parent();
        var colspan = $(cell).attr("colspan");
        $(cell).removeAttr("colspan");
        $(cell).removeClass("occupied");
        var next = $(cell).next();
        for (var i = 1; i < colspan; i++) {
            $(next).removeClass("hidden");
            next = $(next).next();
        }
        $(this).remove();
    });
    $("#courselist ." + code).remove();
    if ($("#courselist").children("tr").length === 0) {
        $("#none").show();
    }
    // add back to search hints of autocomplete
    searchhints.push(code + ": " + data[code]["name"]);
    searchhints.sort();
    delete timetable[code];
    delete courseColor[code];
    // save to cookies
    saveTimetableToStorage();
    compactTable();
    // update Read-Only Mode url
    getURL();
}
function removeSection(code, section) {
    for (var i = 0; i < timetable[code].length;) {
        if (timetable[code][i] === section) {
            timetable[code].splice(i, 1);
        }
        else {
            i++;
        }
    }
    $(".tba." + code + "." + section).remove();
    if ($("#tba-courses").children().length === 0) {
        $("#no-tba").show();
    }
    $("td.occupied div.lesson." + code + "." + section).each(function () {
        var cell = $(this).parent();
        var colspan = $(cell).attr("colspan");
        $(cell).removeAttr("colspan");
        $(cell).removeClass("occupied");
        var next = $(cell).next();
        for (var i = 1; i < colspan; i++) {
            $(next).removeClass("hidden");
            next = $(next).next();
        }
        $(this).remove();
    });
    compactTable();
    getURL();
}
// row: tr element object
function emptyRow(row) {
    var empty = true;
    $(row).children("td").each(function () {
        if ($(this).hasClass("occupied") || $(this).hasClass("hidden")) {
            empty = false;
        }
    });
    return empty;
}
// remove empty row
function compactTable() {
    // shift course box to upper rows if space available
    $(".days").each(function () {
        var rowcount = $(this).children("tr").length;
        for (var rowN = 0; rowN < rowcount - 1 && rowcount > 1; rowN++) {
            var upperRow = $(this).children("tr").eq(rowN);
            for (var i = rowN + 1; i < rowcount; i++) {
                var row = $(this).children("tr").eq(i);
                $.each($(row).children("td").filter(".occupied"), function () {
                    var sh = $(this).attr('class').match(/h[0-9]{2}/i);
                    var sm = $(this).attr('class').match(/m[0-9]{2}/i);
                    var upperRowHasRoom = true;
                    if ($(upperRow).find("." + sh + "." + sm).hasClass('occupied')
                        || $(upperRow).find("." + sh + "." + sm).hasClass('hidden')) {
                        upperRowHasRoom = false;
                    }
                    var next = $(this).next();
                    while ($(next).hasClass('hidden') && upperRowHasRoom) {
                        var h = $(next).attr('class').match(/h[0-9]{2}/i);
                        var m = $(next).attr('class').match(/h[0-9]{2}/i);
                        if ($(upperRow).find("." + h + "." + m).hasClass('occupied')
                            || $(upperRow).find("." + h + "." + m).hasClass('hidden')) {
                            upperRowHasRoom = false;
                        }
                        next = $(next).next();
                    }
                    if (upperRowHasRoom) {
                        var courseDiv = $(this).children('.lesson').eq(0);
                        var colspan = $(this).attr('colspan');
                        $(this).removeAttr('colspan');
                        var cell = $(upperRow).find("." + sh + "." + sm);
                        $(cell).addClass('occupied');
                        $(cell).attr('colspan', colspan)
                        $(cell).append(courseDiv);
                        var next = $(this).next();
                        while ($(next).hasClass('hidden')) {
                            cell = $(cell).next();
                            $(cell).addClass('hidden');
                            $(next).removeClass('hidden');
                            next = $(next).next();
                        }
                        $(this).children('.lesson').remove();
                        $(this).removeClass('occupied');
                    }
                });
            }
        }
    });

    // clear empty rows
    $(".days").each(function () {
        var weekth = $("#" + $(this).attr("id") + " .weekday");
        var rowspan = parseInt($(weekth).attr("rowspan"), 10);
        var rowcount = $(this).children("tr").length;
        if (rowcount > 1) {
            for (var i = 1; i < rowcount; i++) {
                var row = $(this).children("tr").eq(i);
                if (emptyRow(row)) {
                    $(row).addClass("remove");
                    rowspan--;
                }
            }
            $(weekth).attr("rowspan", rowspan);
            $("tr.remove").remove();
            var firstRow = $(this).children("tr").eq(0);
            if (emptyRow(firstRow) && $(this).children("tr").length > 1) {
                rowspan--;
                $(weekth).attr("rowspan", rowspan);
                $(this).children("tr").eq(1).prepend($(weekth));
                $(firstRow).remove();
            }
        }
    });

    // clear time-conflict class
    $(".days").each(function () {
        var rowcount = $(this).children("tr").length;
        if (rowcount === 1) {
            $(this).find('.time-conflict').removeClass('time-conflict');
        }
    });
    var sat_empty = true;
    $("#Sa").children("tr").each(function () {
        if (!emptyRow($(this))) {
            sat_empty = false;
            return false;
        }
    });
    if (sat_empty) $("#Sa").removeClass("hidden").addClass("hidden");
    var sun_empty = true;
    $("#Su").children("tr").each(function () {
        if (!emptyRow($(this))) {
            sun_empty = false;
            return false;
        }
    });
    if (sun_empty) $("#Su").removeClass("hidden").addClass("hidden");

    // add a spare tr to each weekday if only one row
    $(".days").each(function () {
        var rowcount = $(this).children("tr").length;
        if (rowcount === 1) {
            $(this).children("tr").find("th.weekday").attr("rowspan", 2);
            $(this).append('<tr class="spare-tr"><td class="h09 m00"></td><td class="h09 m30"></td><td class="h10 m00"></td><td class="h10 m30"></td><td class="h11 m00"></td><td class="h11 m30"></td><td class="h12 m00"></td><td class="h12 m30"></td><td class="h13 m00"></td><td class="h13 m30"></td><td class="h14 m00"></td><td class="h14 m30"></td><td class="h15 m00"></td><td class="h15 m30"></td><td class="h16 m00"></td><td class="h16 m30"></td><td class="h17 m00"></td><td class="h17 m30"></td><td class="h18 m00"></td><td class="h18 m30"></td><td class="h19 m00"></td><td class="h19 m30"></td><td class="h20 m00"></td><td class="h20 m30"></td><td class="h21 m00"></td><td class="h21 m30"></td><td class="h22 m00"></td><td class="h22 m30"></td></tr>');
        }
    });

    updateConflictStyle();
}

function updateConflictStyle() {
    // update time conflict shadows
    $.each($(".occupied"), function () {
        var cell = $(this);
        var code = $(cell).children("div.lesson").eq(0).attr('name').split("_")[0];
        var hasDate = $(cell).children("div.lesson").eq(0).attr('datestart') !== ""
            && $(cell).children("div.lesson").eq(0).attr('dateend') !== "";
        var date_start = null, date_end = null;
        if (hasDate) {
            date_start = new Date($(cell).children("div.lesson").eq(0).attr('datestart'));
            date_end = new Date($(cell).children("div.lesson").eq(0).attr('dateend'));
        }
        var weekday = $(cell).parentsUntil("tbody").parent().attr("id");
        var h = $(cell).attr('class').match(/h[0-9]{2}/i);
        var m = $(cell).attr('class').match(/m[0-9]{2}/i);
        var hasConflict = false;
        var oCount = $("#" + weekday + " ." + h + "." + m + ".occupied").length;
        var hCount = $("#" + weekday + " ." + h + "." + m + ".hidden").length;
        if (oCount !== 1 || hCount > 0) {
            if (!hasDate) hasConflict = true;
            else {
                var conflictCourses = $.makeArray($("#" + weekday + " ." + h + "." + m + ".occupied"));
                $.each($("#" + weekday + " ." + h + "." + m + ".hidden"), function () {
                    conflictCourses.push($(this).prevUntil('.occupied').prev());
                });
                console.log(conflictCourses)
                for (var i = 0; i < conflictCourses.length && !hasConflict; i++) {
                    var course_div = $(conflictCourses[i]).children("div.lesson").eq(0);
                    var $course_div = $(course_div);
                    if (!$course_div.attr("name") || code === $course_div.attr('name').split("_")[0]) continue;
                    var c_hasDate = $(course_div).attr('datestart') !== "" && $(course_div).attr('dateend') !== "";
                    var c_date_start = null, c_date_end = null;
                    if (c_hasDate) {
                        c_date_start = new Date($(course_div).attr('datestart'));
                        c_date_end = new Date($(course_div).attr('dateend'));
                        if (!(+date_start >= +c_date_end || +date_end <= +c_date_start)) {
                            hasConflict = true;
                        }
                    }
                    else {
                        hasConflict = true;
                    }
                }
            }
        }
        var next = $(cell).next();
        while ($(next).hasClass('hidden') && !hasConflict) {
            h = $(next).attr('class').match(/h[0-9]{2}/i);
            m = $(next).attr('class').match(/m[0-9]{2}/i);
            oCount = $("#" + weekday + " ." + h + "." + m + ".occupied").length;
            hCount = $("#" + weekday + " ." + h + "." + m + ".hidden").length;
            if (oCount > 0 || hCount !== 1) {
                if (!hasDate) hasConflict = true;
                else {
                    var conflictCourses = $.makeArray($("#" + weekday + " ." + h + "." + m + ".occupied"));
                    $.each($("#" + weekday + " ." + h + "." + m + ".hidden"), function () {
                        conflictCourses.push($(this).prevAll('.occupied').eq(0));
                    });
                    for (var i = 0; i < conflictCourses.length && !hasConflict; i++) {
                        var course_div = $(conflictCourses[i]).children("div.lesson").eq(0);
                        if (code === $(course_div).attr('name').split("_")[0]) continue;
                        var c_hasDate = $(course_div).attr('datestart') !== "" && $(course_div).attr('dateend') !== "";
                        var c_date_start = null, c_date_end = null;
                        if (c_hasDate) {
                            c_date_start = new Date($(course_div).attr('datestart'));
                            c_date_end = new Date($(course_div).attr('dateend'));
                            if (!(+date_start >= +c_date_end || +date_end <= +c_date_start)) {
                                hasConflict = true;
                            }
                        }
                        else {
                            hasConflict = true;
                        }
                    }
                }
            }
            next = $(next).next();
        }
        $(cell).children('.lesson').removeClass('time-conflict');
        if (hasConflict) $(cell).children('.lesson').addClass('time-conflict');
    });
}

// add course boxes of available sections of the section type
function addVirtualCourse(code, section) {
    var sectiontype = section.match(/[A-Z]+/i);
    var sections = getSections(code);
    var singleton = (sections[sectiontype].length === 1);
    for (var i = 0; i < sections[sectiontype].length; i++) {
        if (sections[sectiontype][i] === section) {
            continue;
        }
        addSection(data[code], sections[sectiontype][i], singleton, true);
    }
    updateConflictStyle();
}

function removeVirtualCourse(code) {
    $("td.occupied div.lesson.virtual." + code).each(function () {
        var cell = $(this).parent();
        var colspan = $(cell).attr("colspan");
        $(cell).removeAttr("colspan");
        $(cell).removeClass("occupied");
        var next = $(cell).next();
        for (var i = 1; i < colspan; i++) {
            $(next).removeClass("hidden");
            next = $(next).next();
        }
        $(this).remove();
    });
    compactTable();
}

function setTimeConflict(weekday, start, end) {
    var start_time = parseInt(start.substr(0, 2).concat(start.substr(3, 2)), 10);
    if (start.substr(5, 2) === "PM" && start.substr(0, 2) !== "12") {
        start_time += 1200;
    }
    var end_time = parseInt(end.substr(0, 2) + end.substr(3, 2), 10);
    if (end.substr(5, 2) === "PM" && end.substr(0, 2) !== "12") {
        end_time += 1200;
    }
    var starth = Math.floor(start_time / 100);
    var startm = start_time % 100;
    var endh = Math.floor(end_time / 100);
    var endm = end_time % 100;
    if (endm <= 30) endm = 0;
    else if (endm <= 60) endm = 30;
    for (var i = starth; i <= endh; i++) {
        for (var j = 0; j < 60; j += 30) {
            if (i === starth && j < startm) continue;
            if (i === endh && j > endm) break;
            var h = "h".concat((i < 10) ? ("0".concat(i)) : i);
            var m = "m".concat((j < 10) ? "0".concat(j) : j);
            //$("#"+weekday+" ."+h+"."+m).removeClass('time-conflict').addClass('time-conflict');
            $.each($("#" + weekday + " ." + h + "." + m), function () {
                if ($(this).hasClass('hidden')) {
                    var firstcell = $(this).prevUntil('.occupied').prev();
                    $(firstcell).children('.lesson').removeClass('time-conflict').addClass('time-conflict');
                }
                else if ($(this).hasClass('occupied')) {
                    $(this).children('.lesson').removeClass('time-conflict').addClass('time-conflict');
                }
            });
        }
    }
}

function storeValue(key, value) {
    if (typeof(Storage) !== "undefined") {
        localStorage.setItem(key, value);
    }
    else {
        var d = new Date();
        d.setTime(d.getTime() + (COOKIE_EXPIRE_DAYS * 24 * 60 * 60 * 1000));
        var expires = "expires=" + d.toGMTString();
        document.cookie = key + "=" + value + "; " + expires;
    }
}

function getStoredValue(key) {
    if (typeof(Storage) !== "undefined") {
        return localStorage.getItem(key) == null ? "" : localStorage.getItem(key);
    }
    else {
        var name = key + "=";
        var ca = document.cookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1);
            if (c.indexOf(name) !== -1) return c.substring(name.length, c.length);
        }
        return "";
    }
}

function loadFromUrlOrStorage() {
    var timetableStr = "";
    if (getURLParameter("timetable") !== null) {
        var timetableSemester = getURLParameter("semester");
        if (timetableSemester == terms["current"]["num"]) {
            timetableStr = getURLParameter("timetable");
            readMode = true;
            $("#readmode").show();
        }
        else {
            location.replace(HTTP_PATH);
        }
    }
    else {
        var timetableSemester = getStoredValue("timetable-semester");
        if (timetableSemester == terms["current"]["num"]) {
            timetableStr = getStoredValue("timetable");
        }
        $("#readmode").hide();
    }
    timetableStr = decodeURIComponent(timetableStr);
    $("#loading").show();
    var res = timetableStr.split("!");
    for (var i = 0; i < res.length; i++) {
        if (res[i] === "") continue;
        var rc = res[i].split("_");
        addCourse(rc[0], rc[1].split(","));
    }
    $("#loading").hide();
    $(".content").show();
    if (readMode) {
        $(".lesson.draggable").draggable("disable");
        $(".lesson").css("cursor", "default");
        $("img").filter("[title='Remove']").parents("a").hide();
        $("#add").val("Click the logo to exit Read-Only Mode");
        $("#add").prop("disabled", true);
    }
    else {
        $("#add").trigger("focusout");
    }
}

function saveTimetableToStorage() {
    if (readMode) return; // reading others timetable
    var timetableStr = "";
    for (var code in timetable) {
        var sectionStr = "";
        for (var i = 0; i < timetable[code].length; i++) {
            if (i !== 0) sectionStr += ",";
            sectionStr += timetable[code][i];
        }
        timetableStr += code + ":_" + sectionStr + "!";
    }
    storeValue("timetable", encodeURIComponent(timetableStr));
    storeValue("timetable-semester", semester["num"]);
}

function getURL() {
    var timetableStr = "";
    for (var code in timetable) {
        var sectionStr = "";
        for (var i = 0; i < timetable[code].length; i++) {
            if (i !== 0) sectionStr += ",";
            sectionStr += timetable[code][i];
        }
        timetableStr += code + ":_" + sectionStr + "!";
    }
    var url = "./?semester="+semester["num"]+"&timetable=" + encodeURIComponent(timetableStr);
    $("#dialog").children().remove();
    $("#dialog").append("<a href='" + url + "' target='_blank'><button id='readmodebtn' style='width: 120px;'>READ-ONLY</button></a>");
    $("#readmodebtn").button();
    return url;
}

function getURLParameter(sParam) {
    var sPageURL = window.location.search.substring(1);
    var sURLVariables = sPageURL.split('&');
    for (var i = 0; i < sURLVariables.length; i++) {
        var sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] === sParam) {
            return sParameterName[1];
        }
    }
    return null;
}

function switchView() {
    if ($("#timetable_wrapper").hasClass("vertical-timetable")) {
        $("#timetable_wrapper").removeClass("vertical-timetable");
        storeValue('vertical', false);
    }
    else {
        $("#timetable_wrapper").addClass("vertical-timetable");
        storeValue('vertical', true);
    }
    scrollTo(0, 0);
}

function shareTimetable() {
    var url = getURL();
    url = HTTP_PATH + url.substr(2);
    FB.ui(
        {
            method: 'share',
            href: url
        }, function (response) {
        });
}

function getShareLink() {
    var url = getURL();
    url = HTTP_PATH + url.substr(2);
    $("#shareLinkInput").val(url).show().select();
    var failmsg = "Press CTRL+C (Windows) to Copy.";
    try {
        var successful = document.execCommand('copy');
        if (successful) $("#copyResult").text('Auto Copied to Clip Board.');
        else $("#copyResult").text(failmsg);
    } catch (e) {
        $("#copyResult").text(failmsg);
    }
}

$(document).ready(function () {
    $(document).tooltip({
        //track: true,
        position: {my: "left+15 center", at: "right center+5"},
        tooltipClass: "custom-tooltip-styling"
    });
    if (getStoredValue('vertical') == 'true' && !$("#timetable_wrapper").hasClass("vertical-timetable")) {
        $("#timetable_wrapper").addClass("vertical-timetable");
    }
    $.ajax({
        cache: true,
        url: HTTP_PATH + 'json/data.php',
        type: "GET",
        dataType: "json"
    }).done(function (_data) {
        data = _data;
        terms = data["terms"];
        semester = terms["current"];
        //delete data["terms"];
        loaded = true;
        $.each(data, function (key, val) {
            if (key === "terms" || key === "lastUpdated") return true;
            searchhints.push(key + ': ' + val["name"]);
        });
        getURL();

        $("#add").autocomplete({
            // source: "http://coust.442.hk/json/parser.php?type=searchhints",
            source: searchhints,
            minLength: 0,
            focus: function (event, ui) {
                event.preventDefault();
            },
            select: function (event, ui) {
                event.preventDefault();
                addCourse(ui.item.value, "");
            }
        }).focus(function () {
            $(this).autocomplete("search", "");
        });
        $("#add").click(function () {
            $(this).autocomplete("search", $(this).val());
        });
        // add term info and last update
        $("#update-time").html(data["lastUpdated"]);
        $("#termInfo").html(terms["current"]["text"]);
        // load courses added from cookies
        loadFromUrlOrStorage();
        compactTable();
    });
    $("#timetable").delegate('td', 'mouseover mouseleave', function (e) {
        if (e.target.className === "separator" || e.target.className === "times-tr"
            || e.target.className === "timediv" || e.target.className === "time") {

        }
        else if (e.type === 'mouseover') {
            var $el = $(this);
            $el.parent().parent().find("td").addClass("hover"); // weekday
            var hour_class = $el.attr("class").match(/h[0-2][0-9]/i);
            if (hour_class) $("." + hour_class).addClass("hover");

        }
        else {
            var $el = $(this);
            $el.parent().parent().find("td").removeClass("hover"); // weekday
            var hour_class = $el.attr("class").match(/h[0-2][0-9]/i);
            if (hour_class) $("." + hour_class).removeClass("hover");

        }
    });
    $("#add").focusin(function () {
        $("#add").val("");
        $("#add").css("color", "black");
    });
    $("#add").focusout(function () {
        $("#add").val("Add Courses to Timetable");
        $("#add").css("color", "gray");
    });

    // UI stuff
    $("button").button();
    $("#faq").dialog({
        autoOpen: false,
        width: 800,
        buttons: [
            {
                text: "Close",
                click: function () {
                    $(this).dialog("close");
                }
            }
        ]
    });
    // Link to open the dialog
    $("#show-faq").click(function (event) {
        $("#faq").dialog("open");
        event.preventDefault();
    });
});
