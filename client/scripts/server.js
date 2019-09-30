$(document).ready(reload_machine_list);

var max_id = 0;

function reload_machine_list() {
	$.ajax({
		url: "http://localhost:3000/machines",
		type: "GET",
		crossDomain: true,
		success: (data) => {
			$("#machines").empty();
			data.forEach((machine) => {
				$("#machines")
					.append($("<li class='list-group-item'></li>")
					.text(machine));
				if (max_id < machine) {
					max_id = machine;
				}
			});
		}
	});
}

function register() {
	const id = ++max_id;
	$.ajax({
		url: "http://localhost:3000/register",
		type: "POST",
		contentType: 'application/json',
		data: JSON.stringify({ "machine": id }),
		crossDomain: true,
		success: () => {
			alert("Machine successfully registered with id " + id);
			reload_machine_list();
		},
		error: (xhr, ajaxOptions, thrownError) => {
			alert(xhr.responseText);
		}
	});
}
