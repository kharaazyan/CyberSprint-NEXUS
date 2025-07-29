# === Project Metadata ===
PROJECT      := agent
VERSION      := 1.0.0

# === Directories ===
SRC_DIR      := src
INC_DIR      := include
BUILD_DIR    := build
BIN_DIR      := bin
DIST_DIR     := dist
TEST_DIR     := tests
DEPS_DIR     := deps
EXTERNAL_DIR := external

# === Tools ===
CXX          ?= g++
AR           ?= ar
RM           := rm -rf
MKDIR        := mkdir -p
CURL         := curl
WGET         := wget
GIT          := git

# === Flags ===
CXXFLAGS     := -std=c++20 -Wall -Wextra -I$(INC_DIR) -I$(EXTERNAL_DIR) -I. -pthread -Wno-deprecated-declarations
LDFLAGS      := -pthread -ludev -lsystemd -lcrypto
DEBUG_FLAGS  := -g -O0 -DDEBUG
RELEASE_FLAGS:= -O2 -DNDEBUG

# === Build Type ===
BUILD        := release
CXXFLAGS     += $(RELEASE_FLAGS)
BUILD_TYPE   := Release

# === Source/Objects/Deps ===
SRCS         := $(wildcard $(SRC_DIR)/*.cpp)
OBJS         := $(patsubst $(SRC_DIR)/%.cpp,$(BUILD_DIR)/%.o,$(SRCS))
DEPS         := $(OBJS:.o=.d)

# Add config.cpp to all targets
SRCS         += config.cpp
OBJS         += $(BUILD_DIR)/config.o

# === Executable(s) ===
TARGET       := $(BIN_DIR)/$(PROJECT)
READER_TARGET := $(BIN_DIR)/reader
CONFIG_GENERATOR := $(BIN_DIR)/config_generator

# === Colors ===
GREEN        := \033[0;32m
YELLOW       := \033[1;33m
RED          := \033[0;31m
BLUE         := \033[0;34m
NC           := \033[0m

# === Verbosity ===
V            ?= 0
ifeq ($(V),0)
    Q := @
else
    Q :=
endif

# === External Dependencies URLs ===
IPFS_URL := https://dist.ipfs.tech/kubo/v0.22.0/kubo_v0.22.0_linux-amd64.tar.gz
NLOHMANN_JSON_URL := https://github.com/nlohmann/json/releases/download/v3.12.0/json.hpp
AHO_CORASICK_URL := https://raw.githubusercontent.com/cjgdev/aho_corasick/master/src/aho_corasick/aho_corasick.hpp

# === Configuration ===
CONFIG_DIR := config
CONFIG_FILE := $(CONFIG_DIR)/settings.json

# === Dependency Checks ===
.PHONY: check-deps install-deps check-ipfs install-ipfs download-external-deps check-system-libs

# Check system libraries
check-system-libs:
	@echo "$(BLUE)[INFO] Checking system libraries...$(NC)"
	@echo "$(BLUE)[INFO] Checking libudev...$(NC)"
	@pkg-config --exists libudev || \
		(echo "$(YELLOW)[WARN] libudev not found. Installing...$(NC)" && \
		sudo apt-get install -y libudev-dev || true)
	
	@echo "$(BLUE)[INFO] Checking systemd...$(NC)"
	@pkg-config --exists libsystemd || \
		(echo "$(YELLOW)[WARN] libsystemd not found. Installing...$(NC)" && \
		sudo apt-get install -y libsystemd-dev || true)
	
	@echo "$(BLUE)[INFO] Checking OpenSSL...$(NC)"
	@pkg-config --exists openssl || \
		(echo "$(YELLOW)[WARN] OpenSSL not found. Installing...$(NC)" && \
		sudo apt-get install -y libssl-dev || true)
	
	@echo "$(BLUE)[INFO] Checking inotify...$(NC)"
	@echo "#include <sys/inotify.h>" | $(CXX) -E - > /dev/null 2>&1 || \
		(echo "$(YELLOW)[WARN] inotify headers not found. Installing...$(NC)" && \
		sudo apt-get install -y linux-headers-generic || true)
	@echo "$(GREEN)[✔] System libraries check passed$(NC)"

# Check if IPFS is installed
check-ipfs:
	@echo "$(BLUE)[INFO] Checking IPFS installation...$(NC)"
	@which ipfs > /dev/null 2>&1 || \
		(echo "$(YELLOW)[WARN] IPFS not found. Installing...$(NC)" && $(MAKE) install-ipfs)
	@echo "$(GREEN)[✔] IPFS check passed$(NC)"

# Install IPFS
install-ipfs:
	@echo "$(BLUE)[INFO] Installing IPFS manually...$(NC)"
	@mkdir -p $(DEPS_DIR)
	@cd $(DEPS_DIR) && \
		($(WGET) -q $(IPFS_URL) -O ipfs.tar.gz || $(CURL) -L -o ipfs.tar.gz $(IPFS_URL)) && \
		tar -xzf ipfs.tar.gz && \
		sudo cp kubo/ipfs /usr/local/bin/ && \
		rm -rf kubo ipfs.tar.gz
	@rm -rf $(DEPS_DIR)
	@echo "$(GREEN)[✔] IPFS installed successfully$(NC)"

# Download external dependencies
download-external-deps:
	@echo "$(BLUE)[INFO] Downloading external dependencies...$(NC)"
	@mkdir -p $(EXTERNAL_DIR)
	
	# Download nlohmann/json
	@echo "$(BLUE)[INFO] Downloading nlohmann/json v3.12.0...$(NC)"
	@if [ ! -f $(EXTERNAL_DIR)/json.hpp ]; then \
		($(WGET) -q $(NLOHMANN_JSON_URL) -O $(EXTERNAL_DIR)/json.hpp || \
		$(CURL) -L -o $(EXTERNAL_DIR)/json.hpp $(NLOHMANN_JSON_URL)) && \
		echo "$(GREEN)[✔] nlohmann/json downloaded$(NC)" || \
		echo "$(RED)[ERROR] Failed to download nlohmann/json$(NC)"; \
	else \
		echo "$(GREEN)[✔] nlohmann/json already exists$(NC)"; \
	fi
	
	# Download Aho-Corasick (try multiple sources)
	@echo "$(BLUE)[INFO] Downloading Aho-Corasick algorithm...$(NC)"
	@if [ ! -f $(EXTERNAL_DIR)/aho_corasick.hpp ]; then \
		($(WGET) -q $(AHO_CORASICK_URL) -O $(EXTERNAL_DIR)/aho_corasick.hpp || \
		$(CURL) -L -o $(EXTERNAL_DIR)/aho_corasick.hpp $(AHO_CORASICK_URL)) && \
		echo "$(GREEN)[✔] Aho-Corasick downloaded$(NC)" || \
		echo "$(YELLOW)[WARN] Failed to download Aho-Corasick, using local copy$(NC)"; \
	else \
		echo "$(GREEN)[✔] Aho-Corasick already exists$(NC)"; \
	fi

# Check and install system dependencies
check-deps: check-ipfs check-system-libs
	@echo "$(BLUE)[INFO] Checking system dependencies...$(NC)"
	@which apt-get > /dev/null 2>&1 || \
		(echo "$(RED)[ERROR] apt-get not found. This makefile is for Ubuntu only.$(NC)" && exit 1)
	@echo "$(GREEN)[✔] System dependencies check passed$(NC)"

# Install all dependencies
install-deps: check-deps download-external-deps
	@echo "$(BLUE)[INFO] Installing build dependencies...$(NC)"
	@echo "$(BLUE)[INFO] Installing via apt-get...$(NC)"
	@sudo apt-get update || true
	@sudo apt-get install -y build-essential || true
	@sudo apt-get install -y curl wget git pkg-config || true
	@sudo apt-get install -y libudev-dev libsystemd-dev libssl-dev || true
	@echo "$(GREEN)[✔] Dependencies installation complete$(NC)"

# === Build Targets ===
.PHONY: all clean rebuild install uninstall test lint format docs help deps agent reader config

# Default target
all: deps agent reader config-generator config
	@echo "$(GREEN)[✔] Build complete ($(BUILD_TYPE))$(NC)"

# Dependencies target
deps: install-deps

# Configuration target
config: config-generator
	@echo "$(BLUE)[INFO] Creating default configuration...$(NC)"
	@mkdir -p $(CONFIG_DIR)
	./bin/config_generator

# Build agent executable
agent: $(BIN_DIR)/agent
	@echo "$(GREEN)[✔] Agent built successfully$(NC)"

# Build reader executable
reader: $(BIN_DIR)/reader
	@echo "$(GREEN)[✔] Reader built successfully$(NC)"

# Build config generator executable
config-generator: $(BIN_DIR)/config_generator
	@echo "$(GREEN)[✔] Config generator built successfully$(NC)"

$(BIN_DIR)/agent: $(BUILD_DIR)/agent.o $(BUILD_DIR)/config.o | $(BIN_DIR) $(BUILD_DIR)
	@echo "$(YELLOW)[Linking] $@$(NC)"
	$(Q)$(CXX) $(CXXFLAGS) $^ -o $@ $(LDFLAGS)

$(BIN_DIR)/reader: $(BUILD_DIR)/reader.o $(BUILD_DIR)/config.o | $(BIN_DIR) $(BUILD_DIR)
	@echo "$(YELLOW)[Linking] $@$(NC)"
	$(Q)$(CXX) $(CXXFLAGS) $^ -o $@ $(LDFLAGS)

$(BIN_DIR)/config_generator: $(BUILD_DIR)/config_generator.o $(BUILD_DIR)/config.o | $(BIN_DIR) $(BUILD_DIR)
	@echo "$(YELLOW)[Linking] $@$(NC)"
	$(Q)$(CXX) $(CXXFLAGS) $^ -o $@ $(LDFLAGS)

$(BUILD_DIR)/%.o: $(SRC_DIR)/%.cpp | $(BUILD_DIR)
	@echo "$(YELLOW)[Compiling] $<$(NC)"
	$(Q)$(CXX) $(CXXFLAGS) -MMD -c $< -o $@

$(BUILD_DIR)/config.o: config.cpp | $(BUILD_DIR)
	@echo "$(YELLOW)[Compiling] $<$(NC)"
	$(Q)$(CXX) $(CXXFLAGS) -MMD -c $< -o $@

$(BUILD_DIR) $(BIN_DIR) $(DIST_DIR) $(EXTERNAL_DIR):
	$(Q)$(MKDIR) $@

-include $(DEPS)

clean:
	$(Q)$(RM) $(BUILD_DIR) $(BIN_DIR) $(DIST_DIR)
	$(Q)$(RM) $(CONFIG_FILE)
	@echo "$(GREEN)[✔] Cleaned$(NC)"

clean-deps:
	$(Q)$(RM) -rf $(DEPS_DIR) 2>/dev/null || true
	@echo "$(GREEN)[✔] Dependencies cleaned$(NC)"

clean-external:
	$(Q)$(RM) $(EXTERNAL_DIR)
	@echo "$(GREEN)[✔] External libraries cleaned$(NC)"

clean-all: clean clean-deps clean-external
	$(Q)$(RM) -rf $(CONFIG_DIR)
	$(Q)$(RM) -rf tmp/
	$(Q)$(RM) -rf logs/
	@echo "$(GREEN)[✔] All cleaned$(NC)"

rebuild: clean all

# === Installation Targets ===
install: $(TARGET) $(READER_TARGET)
	@echo "$(BLUE)[INFO] Installing $(PROJECT)...$(NC)"
	@sudo cp $(TARGET) /usr/local/bin/ || \
		(echo "$(RED)[ERROR] Failed to install agent. Try running with sudo.$(NC)" && exit 1)
	@sudo cp $(READER_TARGET) /usr/local/bin/ || \
		(echo "$(RED)[ERROR] Failed to install reader. Try running with sudo.$(NC)" && exit 1)
	@echo "$(GREEN)[✔] $(PROJECT) and reader installed to /usr/local/bin/$(NC)"

uninstall:
	@echo "$(BLUE)[INFO] Uninstalling $(PROJECT)...$(NC)"
	@sudo rm -f /usr/local/bin/$(PROJECT) /usr/local/bin/reader || true
	@echo "$(GREEN)[✔] $(PROJECT) uninstalled$(NC)"

# === Help ===
help:
	@echo "$(BLUE)Nexus Agent Build System (Ubuntu Only)$(NC)"
	@echo ""
	@echo "$(GREEN)Usage:$(NC) make [target] [V=1]"
	@echo ""
	@echo "$(GREEN)Build Targets:$(NC)"
	@echo "  all        - Build both agent and reader (default)"
	@echo "  agent      - Build only agent executable"
	@echo "  reader     - Build only reader executable"
	@echo "  deps       - Install all dependencies"
	@echo "  clean      - Remove build artifacts"
	@echo "  clean-deps - Remove downloaded dependencies"
	@echo "  clean-external - Remove external libraries"
	@echo "  clean-all  - Remove all artifacts and dependencies"
	@echo "  rebuild    - Clean and build"
	@echo ""
	@echo "$(GREEN)Installation Targets:$(NC)"
	@echo "  install    - Install to system"
	@echo "  uninstall  - Remove from system"
	@echo ""
	@echo "$(GREEN)Variables:$(NC)"
	@echo "  V          - Verbose build (V=1)"
	@echo ""
	@echo "$(GREEN)Dependencies:$(NC)"
	@echo "  C++20 compiler (g++)"
	@echo "  IPFS daemon"
	@echo "  nlohmann/json v3.12.0"
	@echo "  Aho-Corasick algorithm"
	@echo "  libudev (USB monitoring)"
	@echo "  libsystemd (systemd integration)"
	@echo "  libssl (encryption)"
	@echo "  inotify (file monitoring)"
	@echo "  Standard Unix libraries"