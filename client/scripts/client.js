$(document).ready(reload_container_list);

function reload_container_list() {
	$.ajax({
		url: "http://localhost:3000/containers",
		type: "GET",
		crossDomain: true,
		success: (data) => {
			$("#containers").empty();
			$("#running").empty();
			data.forEach((container) => {
				$("#containers")
					.append($("<option></option>")
					.text(container).val(container));
				$.ajax({
					url: "http://localhost:3000/container/" + container,
					type: "GET",
					crossDomain: true,
					success: (data) => {
						data.forEach((machine) => {
							$("#running")
								.append($("<li class='list-group-item'></li>")
								.text(container));
						})
					}
				});
			});
		}
	});
}

function upload() {
	const picker = $("#container-picker");
	const filename = picker[0].files[0].name;
	const name = filename.split(".")[0];

	$.ajax({
		url: "http://localhost:3000/register",
		type: "POST",
		contentType: 'application/json',
		data: JSON.stringify({ "container": name }),
		crossDomain: true,
		success: () => {
			alert("Container successfully uploaded");
			reload_container_list();
		},
		error: (xhr, ajaxOptions, thrownError) => {
			alert(xhr.responseText);
		}
	});
}

function launch() {
	const select = $("#containers");
	const container = select.val();

	$.ajax({
		url: "http://localhost:3000/launch",
		type: "POST",
		contentType: 'application/json',
		data: JSON.stringify({ "container": container }),
		crossDomain: true,
		success: () => {
			alert("Container successfully launched");
			reload_container_list();
		},
		error: (xhr, ajaxOptions, thrownError) => {
			alert(xhr.responseText);
		}
	});
}
