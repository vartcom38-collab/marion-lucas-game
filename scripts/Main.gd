extends Control

const SAVE_PATH := "user://savegame.json"

var game_state := {
	"day": 1,
	"place": "Nîmes",
	"time": "09:00",
	"marion_age": 20,
	"lucas_age": 22,
	"chapter": "home"
}

func _ready() -> void:
	load_game()

func save_game() -> void:
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(game_state))

func load_game() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		return
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if not file:
		return
	var data = JSON.parse_string(file.get_as_text())
	if typeof(data) == TYPE_DICTIONARY:
		game_state.merge(data, true)
