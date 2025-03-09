#!/bin/bash

# Create Python virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt

# Deactivate virtual environment
deactivate

echo "Setup complete! Dependencies installed in virtual environment."
echo "To activate the environment, run: source venv/bin/activate" 