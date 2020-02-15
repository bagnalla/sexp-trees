FILES = main.js
TARGET = bundle.js

.PHONY: all clean

all: 
	browserify $(FILES) -o $(TARGET)

clean:
	rm -f $(TARGET)
