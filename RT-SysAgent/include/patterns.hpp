#pragma once

#include <vector>
#include <string>
#include <fstream>
#include <iostream>
#include "config.hpp"

inline std::vector<std::string> load_patterns(const std::string &filepath = "")
{
    std::vector<std::string> patterns;
    
    // Use config path if no filepath provided
    std::string actual_filepath = filepath;
    if (actual_filepath.empty()) {
        actual_filepath = Config::patterns.pattern_file_path;
    }
    
    std::ifstream file(actual_filepath);
    if (!file)
    {
        std::cerr << "Warning: patterns file '" << actual_filepath << "' not found. Using default patterns.\n";
        patterns = Config::patterns.default_patterns;
        return patterns;
    }

    std::string line;
    while (std::getline(file, line))
    {
        if (!line.empty())
        {
            patterns.push_back(line);
        }
    }

    if (patterns.empty())
    {
        std::cerr << "Warning: patterns file '" << actual_filepath << "' is empty. Using default patterns.\n";
        patterns = Config::patterns.default_patterns;
    }
    return patterns;
}