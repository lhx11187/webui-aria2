var graphSize = 15;
var graphData = [];
var modals = {
	err_connect: undefined,
	change_conf: undefined,
	newDownload_modal: undefined,
	global_settings_modal: undefined,
	global_statistics_modal: undefined,
	about_modal: undefined,
	err_file_api_modal: undefined,
	new_torrent_modal: undefined,
	new_metalink_modal: undefined,
	download_settings_modal: undefined
};
var web_sock = undefined;
var web_sock_queue = [];
var web_sock_id = 0;
var clear_dialogs = function() {
	for(var i in modals) {
		modals[i].modal('hide');
	}
};
var server_conf = {
	host: 'localhost',
	port: 6800,
	user: "",
	pass: ""
};

var set_conf_cookie = function() {
	setCookie('aria2_server_conf', JSON.stringify(server_conf));
}
var get_conf_cookie = function() {
	if (getCookie('aria2_server_conf'.trim())) {
		server_conf = JSON.parse(getCookie('aria2_server_conf'));
	}
}
var custom_aria2_connect = function() {
	clear_dialogs();
	modals.change_conf.modal('show');
};
var update_server_conf = function() {
	var host = $('#input_host').val().trim();
	var port = $('#input_port').val().trim();
	server_conf.user = $('#input_user').val().trim();
	server_conf.pass = $('#input_pass').val().trim();
	if(host.length !== 0) {
		server_conf.host = host;
	}
	if(port.length !== 0) {
		server_conf.port = port;
	}
	web_sock = undefined;
	set_conf_cookie();
	clear_dialogs();
	update_ui();
};

function param_encode(param) {
	if(param) {
		param = base64.btoa(JSON.stringify(param));
	}
	return param;
}

var web_sock_error = function() {
	for(var i = 0; i < web_sock_queue.length; i++) {
		web_sock_queue[i].error();
		web_sock_queue.splice(i, 1);
	}
}
var web_sock_message = function(message) {
	var data = JSON.parse(message.data);
	for(var i = 0; i < web_sock_queue.length; i++) {
		if(web_sock_queue[i].id === data.id) {
			if(data.error) {
				if(web_sock_queue[i].error)
					web_sock_queue[i].error();
			}
			else {
				web_sock_queue[i].success(data);
			}
			web_sock_queue.splice(i, 1);
		}
	}
}
var web_sock_send = function(conf, multicall) {
	var id = 'webui_' + (web_sock_id++).toString();
	var data =  {
		jsonrpc: 2.0,
		id: id,
		method: multicall? conf.func:'aria2.' + conf.func,
		params: conf.params
	};
	web_sock_queue.push({
		success: conf.success,
		error: conf.error,
		id: id
	});
	web_sock.send(JSON.stringify(data));
}
var web_sock_init = function() {
	if(!web_sock) {
		var sock = new WebSocket('ws://' + server_conf.host + ':' + server_conf.port + '/jsonrpc');
		sock.onopen = function() {
			console.log('websocket connected!!!');
			web_sock = sock;
		};
		sock.onclose = function() {
			web_sock_error();
			web_sock = undefined;
		};
		sock.onerror = web_sock_error;
		sock.onmessage = web_sock_message;
	}
}

var jsonp_syscall = function(conf, multicall) {
	$.ajax({
		url: 'http://' + server_conf.host + ':' + server_conf.port + '/jsonrpc',
		timeout: 1000,
		data: {
			jsonrpc: 2.0,
			id: 'webui',
			method: multicall? conf.func:'aria2.' + conf.func,
			params: param_encode(conf.params)
		},
		success: conf.success,
		error: function() {
			if(server_conf.user.length) {
				var url = 'http://' +
					server_conf.user +  ":" +
					server_conf.pass + "@" +
					server_conf.host + ':' +
					server_conf.port + '/jsonrpc';

				/* hack for http authentication */
				var img = $('<img/>').attr("src", url);
				$('body').append(img);
				img.remove();

				setTimeout(function() {
					$.ajax({
						url: url,
						timeout: 1000,
						data: {
							jsonrpc: 2.0,
							id: 'webui',
							method: multicall? conf.func:'aria2.' + conf.func,
							params: param_encode(conf.params)
						},
						success: conf.success,
						error: conf.error,
						dataType: 'jsonp',
						jsonp: 'jsoncallback'
					});
				}, 1000);
			}
			else if(conf.error) {
				conf.error();
			}
		},
		dataType: 'jsonp',
		jsonp: 'jsoncallback'
	});
}
var aria_syscall = function(conf, multicall) {
	if(!WebSocket || server_conf.user.length || server_conf.pass.length) {
		jsonp_syscall(conf, multicall);
	}
	else if(web_sock) {
		web_sock_send(conf, multicall);
	}
	else {
		web_sock_init();
		jsonp_syscall(conf, multicall);
	}
}
var update_ui = function() {
	updateDownloads();
};

$(function() {
	if (window.location.protocol === "http:") {
		server_conf.host = window.location.hostname;
	}
	get_conf_cookie();
	var modal_conf = {
		show: false,
		backdrop: false
	};
	modals.err_connect = $('#error_connect').modal(modal_conf);
	modals.change_conf = $('#change_conf').modal(modal_conf);
	modals.newDownload_modal = $('#newDownload_modal').modal(modal_conf);
	modals.global_settings_modal = $('#global_settings_modal').modal(modal_conf);
	modals.download_settings_modal = $('#download_settings_modal').modal(modal_conf);
	modals.global_statistics_modal = $('#global_statistics_modal').modal(modal_conf);
	modals.about_modal = $('#about_modal').modal(modal_conf);
	modals.err_file_api_modal = $('#error_file_api').modal(modal_conf);
	modals.new_torrent_modal = $('#new_torrent').modal(modal_conf);
	modals.new_metalink_modal = $('#new_metalink').modal(modal_conf);

	if(WebSocket)
		web_sock_init();

	update_ui();
	$('#newDownload').click(function() {
		$('#newDownload_url').val("");
		$('.download_urls').html("");
		modals.newDownload_modal.modal('show');
	});

	$('#newDownload_torrent').click(function() {
		$('#input_torrent').val("");
		if(window.File && window.FileReader && window.FileList && window.Blob) {
			modals.new_torrent_modal.modal('show');
		}
		else {
			modals.err_file_api_modal.modal('show');
		}
	});

	$('#newDownload_metalink').click(function() {
		$('#input_metalink').val("");
		if(window.File && window.FileReader && window.FileList && window.Blob) {
			modals.new_metalink_modal.modal('show');

		}
		else {
			modals.err_file_api_modal.modal('show');
		}
	});
	$('#multiple_uris').click(function() {
		var url = $('#newDownload_url').val();
		var html = '<li>';
		html += '<span class="uris">';
		html += url;
		html += '</span>';
		html += '             ';
		html += '<a href="#"><i class="icon-trash"></i></a></li>';
		$(html).appendTo('.download_urls');
		$('#newDownload_url').val("");
		$('.download_urls a').unbind('click').click(function() {
			$(this).parents('li').remove();
		});
	});
	$('#addNewDownload').click(newDownload);
	setInterval(update_ui, 1000);
});
function check_global(name) {
	for(var i = 0; i < global_settings_exclude.length; i++) {
		if(global_settings_exclude[i] === name) {
			return false;
		}
	}
	return true;
}
function merge_settings_data(sets, res) {
	for(var i in res) {
		for(var j = 0; j < sets.length; j++) {
			if(sets[j].name === i) {
				sets[j].value = res[i].trim();
				sets[j].has_value = true;
				if(sets[j].option) {
					for(var k = 0; k < sets[j].options.length; k++) {
						var tmp = {
							val: sets[j].options[k],
							disp: sets[j].options[k]
						};

						if(sets[j].options[k] === sets[j].value) {
							tmp.val = sets[j].value + '" selected="true';
						}
						sets[j].options[k] = tmp;
					}
				}
			}
		}
	}
}
function get_global_settings(cb) {
	var sets = [];
	var tmp_set = [];
	for(var i = 0; i < input_file_settings.length; i++) {
		tmp_set = $.extend(true, {}, input_file_settings[i]);
		if(check_global(tmp_set)) {
			sets.push(tmp_set);
		}
	}
	for(var i = 0; i < global_settings.length; i++) {
		tmp_set = $.extend(true, {}, global_settings[i]);
		if(check_global(tmp_set)) {
			sets.push(tmp_set);
		}
	}
	aria_syscall({
		func: 'getGlobalOption',
		success: function(data) {
			var res = data.result;
			merge_settings_data(sets, res);
			cb(sets);
		},
		error: function() {
			alert("Connection to aria server failed");
		}
	});
}
function custom_global_settings() {
	var gen = function(name) {
		return { name: name, values: [] };
	};
	var general_settings = gen("General Settings");
	var torrent_settings = gen("Bit-Torrent Settings");
	var ftp_settings = gen("FTP Settings");
	var http_settings = gen("HTTP(S) Settings");
	var metalink_settings = gen("Metalink Settings");

	get_global_settings(function(sets) {
		for(var i = 0; i < sets.length; i++) {
			var set = sets[i];
			if(set.name.indexOf("bt") !== -1 || set.name.indexOf("torrent") !== -1) {
				torrent_settings.values.push(set);
			}
			else if(set.name.indexOf("metalink") !== -1) {
				metalink_settings.values.push(set);
			}
			else if(set.name.indexOf("http") !== -1) {
				http_settings.values.push(set);
			}
			else if(set.name.indexOf("ftp") !== -1) {
				ftp_settings.values.push(set);
			}
			else
				general_settings.values.push(set);

		}

		var templ = $('#global_general_settings_template').text();
		var item = Mustache.render(templ, {
			settings: [
				general_settings,
				http_settings,
				ftp_settings,
				torrent_settings,
				metalink_settings
			]
		});
		$('#dynamic_global_settings').html(item);
		modals.global_settings_modal.modal('show');
		$("#save_global_settings").one('click',function() {
			var settings = {};
			for(var i = 0; i < sets.length; i++) {
				var elem = $("#input_settings_" + sets[i].name);
				if(sets[i].value) {
					if(elem.val() !== sets[i].value) {
						settings[sets[i].name] = elem.val();
					}
				}
				else if(elem.val() !== "no_val" && elem.val() !== "") {
					settings[sets[i].name] = elem.val();
				}
			}
			if(!$.isEmptyObject(settings)) {
				aria_syscall({
					func: 'changeGlobalOption',
					params: [settings],
					success: function(data) {
						clear_dialogs();
					}
				});
			}
			else {
				clear_dialogs();
			}
		});
	});
}

function addDownload(uris) {
	console.log("adding download:");
	console.log(uris);
	aria_syscall({
		func: 'addUri',
		params: uris,
		success: function() {
			clear_dialogs();
			update_ui();
		}
	});
}

function newDownload() {
	var li = $('.download_urls li');
	var urls = [];
	for(var i = 0; i < li.length; i++) {
		urls.push($(li[i]).text().trim());

	}
	var inp_url = $('#newDownload_url').val().trim();
	if(inp_url.length > 0) urls.push(inp_url);
	addDownload([urls]);
}

var d_files = {
	active: [],
	waiting: [],
	stopped: []
};
function changeLength(len, pref) {
	len = parseInt(len);
	if(len <= (1<<10)) return len  + " " + pref;
	else if(len <= (1<<20)) return (len/(1<<10)).toFixed(1) + " K" + pref;
	else if(len <= (1<<30)) return (len/(1<<20)).toFixed(1) + " M" + pref;
	else return (len/(1<<30)).toFixed(1) + " G" + pref;
}
function changeTime(time) {
	time = parseInt(time);
	if(!time) return "infinite";
	if(time < 60) return time + " s";
	else if(time < 60*60) return (time/60).toFixed(2) + " min";
	else if(time < 60*60*24) return (time/(60*60)).toFixed(2) + " hours";
	else return (time/(60*60*24)).toFixed(2) + " days!!";

}
function getChunksFromHex(bitfield, numOfPieces) {
	var chunks =  [], len = 0, numPieces = parseInt(numOfPieces);
	var totalDownloaded = 0;
	if (numPieces > 1) {
		var chunk_width = 95 / numPieces;
		var piecesProcessed = 0;
		for (var i = 0; i < bitfield.length; i++) {
			var hex = parseInt(bitfield[i], 16);
			for (var j = 1; j <= 4; j++) {
				var bit = hex & (1 << (4 - j));
				if (bit) totalDownloaded++;
				var prog = bit ? 100 : 0;
				if (len >= 1 && chunks[len - 1].progress == prog) {
					chunks[len - 1].width += chunk_width;
				}
				else {
					chunks.push({
						width: chunk_width,
						progress: prog
					});
					len++;
				}
				piecesProcessed ++;
				if (piecesProcessed == numPieces)
					return chunks;
			}
		}
	}
	return chunks;
}
function getTemplateCtx(data) {
	var percentage =(data.completedLength / data.totalLength)*100;
	percentage = percentage.toFixed(2);
	if(!percentage) percentage = 0;
	var name;
	var seed = (data.files[0].path || data.files[0].uris[0].uri).split(/[/\\]/);
	name = seed[seed.length - 1];
	var chunks =  percentage !== 100 ? getChunksFromHex(data.bitfield, data.numPieces) : [];

	var eta = changeTime((data.totalLength-data.completedLength)/data.downloadSpeed);
	return {
		name: name,
		sett_name: name.substr(0,name.lastIndexOf('.')) || name,
		status: data.status,
		percentage:percentage,
		gid: data.gid,
		size: changeLength(data.totalLength, "B"),
		down_speed: changeLength(data.downloadSpeed, "B/s"),
		remaining: changeLength(data.totalLength - data.completedLength, "B"),
		eta: eta,
		downloaded: changeLength(data.completedLength, "B"),
		dir: data.dir,
		numPieces: data.numPieces,
		pieceLength: changeLength(data.pieceLength, "B"),
		uploadLength: changeLength(data.uploadLength, "B"),
		connections: data.connections,
		upload_speed: changeLength(data.uploadSpeed, "B/s"),
		booleans: {
			is_error: data.status === "error",
		},
		chunks: chunks
	};
}
function updateDownloadTemplates(elem, ctx) {
	elem = $(elem);
	for(var i in ctx) {
		elem.find('.tmp_' + i).text(ctx[i]);
	}
	elem.find('.full-progress .bar').css('width', ctx.percentage + '%');
	var chunks = ctx.chunks;
	if (!chunks || !chunks.length) {
		return;
	}
	var partialParent = elem.find(".active_chunks");
	var diff = partialParent.children().length - chunks.length;
	if (diff > 0) {
		partialParent.children().slice(0, diff).remove();
		/*
		diff = (partialParent.children().length - chunks.length);
		if (diff != 0) {
			console.log(diff);
			console.log("diff error in deleting!!!");
			return;
		}
		*/
	}
	else if (diff < 0){
		diff = (-1) * diff;
		var html = '<div class="progress progress-striped progress-chunk" style="width:'
			+ chunks[0].width + '%;"><div class="bar" style="width: 0%;"></div></div>';
		partialParent.append((new Array(diff + 1)).join(html));
		/*
		diff = (partialParent.children().length - chunks.length);
		if (diff != 0) {
			console.log(diff);
			console.log("diff error in appending!!!");
			return;
		}
		*/
	}
	partialParent.children().each(function(index, node) {
		$(node).css({width: chunks[index].width.toString()  + "%" });
		$(node).children().css({width: chunks[index].progress.toString()  + "%" });
	});
}
function deleteDownloadTemplates(top_elem, data) {
	if(!data) {
		graphData = [];
		$(top_elem).html("");
	}
	else {
		var elems = $(top_elem).find('[data-gid]');
		for(var i = 0; i < elems.length; i++) {
			var elem = $(elems[i]);
			var gid = elem.attr('data-gid').toString();
			var found = false;
			for(var j = 0; j < data.length; j++) {
				if(gid === data[j].gid.toString())
					found = true;
			}
			if(!found) {
				for (var k = 0; k < graphData.length; k++) {
					if (graphData[k].gid == gid) {
						graphData.splice(k, 1);
						break;
					}
				}
				elem.remove();
			}
		}
	}
}
function refreshDownloadTemplates(top_elem, data) {
	var down_template = $('#download_' + top_elem + '_template').text();
	deleteDownloadTemplates('#' + top_elem + '_downloads', data);
	for(var i = 0; i < data.length; i++) {
		var ctx = getTemplateCtx(data[i]);
		var elem = $('[data-gid=' + ctx.gid + ']');
		if(elem.length) {
			updateDownloadTemplates(elem, ctx);
		} else {
			var item = Mustache.render(down_template, ctx);
			$('#' + top_elem + '_downloads').prepend(item);
		}
	}
	$('#' + top_elem + '_downloads').children('.hero-unit').remove();

}
function updateGraph(gid) {
	var elem = $('[data-gid=' + gid + ']');
	for (var i = 0; i < graphData.length; i++) {
		if (graphData[i].gid == gid) {
			var moreInfo = $(elem).find(".more_info");
			if (moreInfo.hasClass("in")) {
				window.data = graphData[i];
				graphData[i].plot.setData([{
					label: "Download Speed",
					data: graphData[i].downSpeed,
					color: "#ff0000",
					lines: { show: true }
				}, {
					label: "Upload Speed",
					data: graphData[i].upSpeed,
					color: "#00ff00",
					lines: { show: true }
				}]);
				graphData[i].plot.setupGrid();
				graphData[i].plot.draw();
			}
		}
	}
}
function createGraph(gid) {
	return $.plot('[data-gid=' + gid + '] .active_graph', [{
		label: "Download Speed",
		data: [],
		color: "#ff0000",
		lines: { show: true }
	}, {
		label: "Upload Speed",
		data: [],
		color: "#00ff00",
		lines: { show: true }
	}], {
		legend: { show: true },
		xaxis: { show: true },
		yaxis: {
			tickFormatter: function(val, axis) {
				return changeLength(val, "B/s");
			},
			min: 0
		}
	});
}
function updateGraphData(data) {
	for (var i = 0; i < data.length; i++) {
		var gid = data[i].gid;
		var graph = null;
		for (var k = 0; k < graphData.length; k++) {
			if (graphData[k].gid == gid) {
				graph = graphData[k];
				break;
			}
		}
		var downSpeed = data[i].downloadSpeed;
		var upSpeed = data[i].uploadSpeed;
		var that = this;
		if (!graph) {
			graphData.push((function() {
				return {
					gid: gid,
					downSpeed: [],
					upSpeed: [],
					add: function(arr, val) {
						if (arr.length == graphSize) {
							arr.shift();
						}
						arr.push([((new Date - this.start)/1000).toFixed(0), val]);
					},
					addDown: function(val) {
						this.add(this.downSpeed, val);
						return this;
					},
					addUp: function(val) {
						this.add(this.upSpeed, val);
						return this;
					},
					plot: that.createGraph(gid),
					start: new Date()
				}
			})().addDown(downSpeed).addUp(upSpeed));
		}
		else {
			graph.addDown(downSpeed).addUp(upSpeed);
		}
		this.updateGraph(gid);
	}
}
function getActiveSettings(gid, cb) {
	var sets = [];
	var tmp_set = [];
	for(var i = 0; i < download_active_settings.length; i++) {
		tmp_set = $.extend(true, {}, download_active_settings[i]);
		sets.push(tmp_set);
	}
	aria_syscall({
		func: 'getOption',
		params: [gid],
		success: function(data) {
			var res = data.result;
			merge_settings_data(sets, res);
			cb(sets);
		},
		error: function() {
			alert("Connection to aria server failed");
		}
	});
}
function check_waiting(name) {
	for(var i = 0; i < download_waiting_exclude.length; i++) {
		if(download_waiting_exclude[i] === name) {
			return false;
		}
	}
	return true;
}
function getWaitingSettings(gid, cb) {
	var sets = [];
	var tmp_set = [];
	for(var i = 0; i < input_file_settings.length; i++) {
		tmp_set = $.extend(true, {}, input_file_settings[i]);
		if(check_waiting(tmp_set)) {
			sets.push(tmp_set);
		}
	}
	for(var i = 0; i < download_active_settings.length; i++) {
		tmp_set = $.extend(true, {}, download_active_settings[i]);
		if(check_waiting(tmp_set)) {
			sets.push(tmp_set);
		}
	}
	aria_syscall({
		func: 'getOption',
		params: [gid],
		success: function(data) {
			var res = data.result;
			merge_settings_data(sets, res);
			cb(sets);
		},
		error: function() {
			alert("Connection to aria server failed");
		}
	});
}
function empty_download_set(elem) {
	var len = d_files.active.length;
	len += d_files.waiting.length;
	len += d_files.stopped.length;
	if(len === 0) {
		var html = '<div class="hero-unit"><h3>';

		html += 'Currently no downloads in line to display, use the Add download button to start downloading files!';
		html += '</h3></div>';
		$(elem).html(html);
	}
}
function updateActiveDownloads(data) {
	refreshDownloadTemplates('active', data);
	updateGraphData(data);
	empty_download_set('#active_downloads');
	$('.download_active_item .download_settings').unbind('click').click(function() {
		var gid = $(this).parents('.download_active_item').attr('data-gid');
		var settings_name = $(this).parents('.download_active_item').attr('data-settingsName');
		var gen = function(name) {
			return { name: name, values: [] };
		};
		var general_settings = gen("General Settings");
		var torrent_settings = gen("Bit-Torrent Settings");

		getActiveSettings(gid, function(sets) {
			for(var i = 0; i < sets.length; i++) {
				var set = sets[i];
				if(set.name.indexOf("bt") !== -1 || set.name.indexOf("torrent") !== -1) {
					torrent_settings.values.push(set);
				}
				else
					general_settings.values.push(set);

			}

			var templ = $('#download_settings_template').text();
			var item = Mustache.render(templ, {
				settings_name: settings_name,
				gid: gid,
				settings: [
					general_settings,
					torrent_settings
				]
			});
			$('#download_settings_modal').html(item);
			modals.download_settings_modal.modal('show');
			$("#save_download_settings").one('click',function() {
				var settings = {};
				for(var i = 0; i < sets.length; i++) {
					var elem = $("#download_settings_" + sets[i].name);
					if(sets[i].value) {
						if(elem.val() !== sets[i].value) {
							settings[sets[i].name] = elem.val();
						}
					}
					else if(elem.val() !== "no_val" && elem.val() !== "") {
						settings[sets[i].name] = elem.val();
					}
				}
				if(!$.isEmptyObject(settings)) {
					aria_syscall({
						func: 'changeOption',
						params: [gid, settings],
						success: function(data) {
							clear_dialogs();
						}
					});
				}
				else {
					clear_dialogs();
				}
			});
		});
	});
	$('.download_active_item .download_pause').unbind('click').click(function() {
		var gid = $(this).parents('.download_active_item').attr('data-gid');
		aria_syscall({
			func: 'forcePause',
			params: [gid],
			success: function() {
				update_ui();
			},
			error: function(err) {
				console.log("error pausing active download!!!");
				console.log(err);
			}
		});
	});
	$('.download_active_item .download_remove').unbind('click').click(function() {
		var gid = $(this).parents('.download_active_item').attr('data-gid');
		aria_syscall({
			func: 'remove',
			params: [gid],
			success: function() {
				update_ui();
			},
			error: function(err) {
				console.log("error removing active download!!!");
				console.log(err);
			}
		});
	});
}
function updateWaitingDownloads(data) {
	refreshDownloadTemplates('waiting', data);
	$('.download_waiting_item .download_settings').unbind('click').click(function() {
		var gid = $(this).parents('.download_waiting_item').attr('data-gid');
		var settings_name = $(this).parents('.download_waiting_item').attr('data-settingsName');
		var gen = function(name) {
			return { name: name, values: [] };
		};
		var general_settings = gen("General Settings");
		var torrent_settings = gen("Bit-Torrent Settings");
		var ftp_settings = gen("FTP Settings");
		var http_settings = gen("HTTP(S) Settings");
		var metalink_settings = gen("Metalink Settings");

		getWaitingSettings(gid, function(sets) {
			for(var i = 0; i < sets.length; i++) {
				var set = sets[i];
				if(set.name.indexOf("bt") !== -1 || set.name.indexOf("torrent") !== -1) {
					torrent_settings.values.push(set);
				}
				else if(set.name.indexOf("metalink") !== -1) {
					metalink_settings.values.push(set);
				}
				else if(set.name.indexOf("http") !== -1) {
					http_settings.values.push(set);
				}
				else if(set.name.indexOf("ftp") !== -1) {
					ftp_settings.values.push(set);
				}
				else
					general_settings.values.push(set);

			}

			var templ = $('#download_settings_template').text();
			var item = Mustache.render(templ, {
				settings_name: settings_name,
				gid: gid,
				settings: [
					general_settings,
					http_settings,
					ftp_settings,
					torrent_settings,
					metalink_settings
				]
			});
			$('#download_settings_modal').html(item);
			modals.download_settings_modal.modal('show');
			$("#save_download_settings").one('click',function() {
				var settings = {};
				for(var i = 0; i < sets.length; i++) {
					var elem = $("#download_settings_" + sets[i].name);
					if(sets[i].value) {
						if(elem.val() !== sets[i].value) {
							settings[sets[i].name] = elem.val();
						}
					}
					else if(elem.val() !== "no_val" && elem.val() !== "") {
						settings[sets[i].name] = elem.val();
					}
				}
				if(!$.isEmptyObject(settings)) {
					aria_syscall({
						func: 'changeOption',
						params: [gid, settings],
						success: function(data) {
							clear_dialogs();
						}
					});
				}
				else {
					clear_dialogs();
				}
			});
		});
	});
	$('.download_waiting_item .download_play').unbind('click').click(function() {
		var gid = $(this).parents('.download_waiting_item').attr('data-gid');
		aria_syscall({
			func: 'unpause',
			params: [gid],
			success: function(data) {
				update_ui();
			},
			error: function(err) {
				console.log("error playing waiting download!!!");
				console.log(err);
			}
		});
	});
	$('.download_waiting_item .download_remove').unbind('click').click(function() {
		var gid = $(this).parents('.download_waiting_item').attr('data-gid');
		aria_syscall({
			func: 'remove',
			params: [gid],
			success: function() {
				update_ui();
			},
			error: function(err) {
				console.log("error removing waiting download!!!");
				console.log(err);
			}
		});
	});
}

function updateStoppedDownloads(data) {
	refreshDownloadTemplates('stopped', data);
	$('.download_stopped_item .download_remove').unbind('click').click(function() {
		var gid = $(this).parents('.download_stopped_item').attr('data-gid');
		aria_syscall({
			func: 'removeDownloadResult',
			params: [gid],
			success: function() {
				update_ui();
			},
			error: function(err) {
				console.log("error removing stopped download!!!");
				console.log(err);
			}
		});
	});
	$('.download_stopped_item .download_restart').unbind('click').click(function() {
		var gid = $(this).parents('.download_stopped_item').attr('data-gid');
		var files;
		var uris = [];
		for(var i = 0; i < d_files.stopped.length; i++) {
			if(d_files.stopped[i].gid === gid) {
				files = d_files.stopped[i].files;
				break;
			}
		}
		for(var i = 0; i < files.length; i++) {
			var tmp_uris = [];
			for(var j = 0; j < files[i].uris.length; j++) {
				tmp_uris.push(files[i].uris[j].uri);
			}
			uris.push(tmp_uris);
		}
		addDownload(uris);
		aria_syscall({
			func: 'removeDownloadResult',
			params: [gid],
			success: function() {
				update_ui();
			},
			error: function(err) {
				console.log("error removing stopped download!!!");
				console.log(err);
			}
		});
	});
}


function mergeDownloads(data) {
	d_files.active = data[0][0];
	d_files.waiting = data[1][0];
	d_files.stopped = data[2][0];
}

function updateDownloads() {
	aria_syscall({
		func: 'system.multicall',
		params:[[{
			methodName: 'aria2.tellActive'
		}, {
			methodName: 'aria2.tellWaiting',
			params: [0,100]
		}, {
			methodName: 'aria2.tellStopped',
			params: [0, 100]
		}, {
			methodName: "aria2.getGlobalStat"
		}]],
		success: function(data) {
			mergeDownloads(data.result);
			updateStoppedDownloads(d_files.stopped);
			updateWaitingDownloads(d_files.waiting);
			updateActiveDownloads(d_files.active);
			updateGlobalStatistics(data.result[3][0]);
		},
		error: function() {
			modals.err_connect.modal('show');
		}
	}, true);
}

function updateGlobalStatistics(data) {
	data.downloadSpeed = changeLength(data.downloadSpeed, "B/s");
	data.uploadSpeed = changeLength(data.uploadSpeed, "B/s");
	for(var i in data) {
		$('.stat_' + i).text(data[i]);
	}
}
function custom_global_statistics() {
	var tmpl = $('#global_statistics_template').text();
	modals.global_statistics_modal.modal('show');
}

function show_about() {
	aria_syscall({
		func: 'getVersion',
		success: function(data) {
			$('.about_aria_version').text(data.result.version);
			$('.about_webclient_version').text('beta testing');
			modals.about_modal.modal('show');
		}
	});
}

function force_pause_all() {
	aria_syscall({
		func: 'forcePauseAll',
		success: update_ui
	});
}

function force_remove_all(cb) {
	var remove_params = [];
	var func = function(downs) {
		for(var i = 0; i < downs.length; i++) {
			remove_params.push({
				methodName: 'aria2.remove',
				params: [downs[i].gid]
			});
		}
	}
	func(d_files.active);
	func(d_files.waiting);
	aria_syscall({
		func: 'system.multicall',
		params:[remove_params],
		success: update_ui
	}, true);
}

function force_purge_all() {
	var remove_params = [];
	var func = function(downs) {
		for(var i = 0; i < downs.length; i++) {
			remove_params.push({
				methodName: 'aria2.remove',
				params: [downs[i].gid]
			});
		}
	}
	func(d_files.active);
	func(d_files.waiting);

	aria_syscall({
		func: 'system.multicall',
		params:[remove_params],
		success: function() {
			aria_syscall({
				func: "purgeDownloadResult",
				success: update_ui
			});
		}
	}, true);

}

function add_torrent() {
	var file_node = $('#input_torrent')[0];
	var files = file_node.files;
	if (files.length) {
		for (var i = 0, f; f = files[i]; i++) {
			var reader = new FileReader();

			reader.onload = function(e) {
				var txt = e.target.result;
				txt = txt.split(',')[1];
				aria_syscall({
					func: 'addTorrent',
					params: [txt],
					success: function() {
						clear_dialogs();
						update_ui();
					}
				});
			};
			reader.onerror = function(e) {
				alert('error reading torrent, your browser policy does not allow to read local files, please change to firefox');
			};
			reader.readAsDataURL(f);
		}

	}
	else {
		alert("please select a torrent first!");
	}
}
function add_metalink() {
	var file_node = $('#input_metalink')[0];
	var files = file_node.files;
	if (files.length) {
		for (var i = 0, f; f = files[i]; i++) {
			var reader = new FileReader();

			reader.onload = function(e) {
				var txt = e.target.result;
				txt = txt.split(',')[1];
				aria_syscall({
					func: 'addMetalink',
					params: [txt],
					success: function() {
						clear_dialogs();
						update_ui();
					}
				});
			};
			reader.onerror = function(e) {
				alert('error reading metalink, your browser policy does not allow to read local files, please change to firefox');
			};
			reader.readAsDataURL(f);

		}
	}
	else {
		alert("please select a metalink first!");
	}
}
