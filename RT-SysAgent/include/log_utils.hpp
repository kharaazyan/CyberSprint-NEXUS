#pragma once

#include <string>
#include <vector>
#include <fstream>
#include <chrono>
#include <iomanip>
#include <sstream>
#include <iostream>
#include <cstdlib>
#include <cstdio>
#include "json.hpp"
#include "config.hpp"

#include <openssl/evp.h>
#include <openssl/rand.h>
#include <openssl/pem.h>
#include <openssl/rsa.h>
#include <openssl/err.h>
#include <openssl/bio.h>

using json = nlohmann::json;

inline std::string current_timestamp() {
    using namespace std::chrono;
    auto now = system_clock::now();
    auto ms = duration_cast<milliseconds>(now.time_since_epoch()) % 1000;

    std::time_t t = system_clock::to_time_t(now);
    std::tm tm_utc;
    gmtime_r(&t, &tm_utc); 

    std::stringstream ss;
    ss << std::put_time(&tm_utc, "%Y-%m-%dT%H:%M:%S");
    ss << '.' << std::setw(3) << std::setfill('0') << ms.count() << "Z";
    return ss.str();
}
inline std::string read_prev_cid(const std::string& filepath = "") {
    std::string actual_filepath = filepath;
    if (actual_filepath.empty()) {
        actual_filepath = Config::dirs.get_tmp_path() + "/prev_cid.txt";
    }
    std::ifstream in(actual_filepath);
    if (!in.is_open()) {
        std::ofstream create(actual_filepath);
        return "null";
    }
    std::string cid;
    std::getline(in, cid);
    if(cid.empty()) return "null";
    return cid;
}

inline void save_prev_cid(const std::string& filepath, const std::string& cid) {
    std::ofstream out(filepath, std::ios::trunc);
    if (out.is_open()) {
        out << cid << '\n';
    }
}

inline std::string format_logs_json(const std::vector<std::string>& logs, const std::string& prev_cid) {
    json j;
    j["timestamp"] = current_timestamp();
    j["logs"] = logs;
    j["prev_cid"] = prev_cid.empty() ? nullptr : prev_cid;
    return j.dump(2);
}

inline std::string run_command(const std::string& cmd) {
    std::string result;
    FILE* pipe = popen(cmd.c_str(), "r");
    if (!pipe) return "";
    char buffer[256];
    while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
        result += buffer;
    }
    pclose(pipe);
    return result;
}

inline std::string ipfs_add(const std::string& filepath) {
    std::string check = run_command("pgrep -x ipfs");
    if (check.empty()) {
        std::cerr << "[IPFS] Warning: IPFS daemon not running!\n";
    }

    // Escape the filepath for shell command
    std::string escaped_path = "\"" + filepath + "\"";
    std::string cmd = "ipfs add -q " + escaped_path;
    std::string output = run_command(cmd);
    if (!output.empty()) {
        output.erase(output.find_last_not_of(" \n\r\t") + 1);
    } else {
        std::cerr << "[IPFS] Error: Could not add file.\n";
    }

    return output;
}

inline std::vector<uint8_t> generate_random_bytes(size_t size) {
    std::vector<uint8_t> buffer(size);
    if (!RAND_bytes(buffer.data(), size)) {
        throw std::runtime_error("Failed to generate secure random bytes.");
    }
    return buffer;
}

inline std::vector<uint8_t> aes_gcm_encrypt(const std::string& plaintext,
                                            const std::vector<uint8_t>& key,
                                            std::vector<uint8_t>& out_iv,
                                            std::vector<uint8_t>& out_tag) {
    const int iv_len = 12;
    out_iv = generate_random_bytes(iv_len);
    out_tag.resize(16);

    std::vector<uint8_t> ciphertext(plaintext.size());

    EVP_CIPHER_CTX* ctx = EVP_CIPHER_CTX_new();
    if (!ctx) throw std::runtime_error("Failed to create EVP_CIPHER_CTX");

    if (EVP_EncryptInit_ex(ctx, EVP_aes_256_gcm(), nullptr, nullptr, nullptr) != 1)
        throw std::runtime_error("AES-GCM init failed");

    EVP_EncryptInit_ex(ctx, nullptr, nullptr, key.data(), out_iv.data());

    int len;
    int ciphertext_len;
    if (EVP_EncryptUpdate(ctx, ciphertext.data(), &len,
                          reinterpret_cast<const unsigned char*>(plaintext.data()),
                          plaintext.size()) != 1)
        throw std::runtime_error("AES-GCM update failed");

    ciphertext_len = len;

    if (EVP_EncryptFinal_ex(ctx, ciphertext.data() + len, &len) != 1)
        throw std::runtime_error("AES-GCM finalization failed");

    ciphertext_len += len;

    if (EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_GET_TAG, 16, out_tag.data()) != 1)
        throw std::runtime_error("AES-GCM tag fetch failed");

    EVP_CIPHER_CTX_free(ctx);
    ciphertext.resize(ciphertext_len);
    return ciphertext;
}

inline std::vector<uint8_t> rsa_encrypt_key(const std::vector<uint8_t>& key, const std::string& pubkey_path) {
    FILE* pubkey_file = fopen(pubkey_path.c_str(), "rb");
    if (!pubkey_file) throw std::runtime_error("Cannot open RSA public key file.");

    RSA* rsa = PEM_read_RSA_PUBKEY(pubkey_file, nullptr, nullptr, nullptr);
    fclose(pubkey_file);
    if (!rsa) throw std::runtime_error("Failed to read RSA public key.");

    std::vector<uint8_t> encrypted(RSA_size(rsa));
    int len = RSA_public_encrypt(key.size(), key.data(), encrypted.data(), rsa, RSA_PKCS1_OAEP_PADDING);
    RSA_free(rsa);

    if (len == -1) throw std::runtime_error("RSA encryption failed.");
    encrypted.resize(len);
    return encrypted;
}

inline std::string base64_encode(const std::vector<uint8_t>& data) {
    BIO* bio, *b64;
    BUF_MEM* bufferPtr;

    b64 = BIO_new(BIO_f_base64());
    bio = BIO_new(BIO_s_mem());
    b64 = BIO_push(b64, bio);

    BIO_set_flags(b64, BIO_FLAGS_BASE64_NO_NL);
    BIO_write(b64, data.data(), data.size());
    BIO_flush(b64);
    BIO_get_mem_ptr(b64, &bufferPtr);

    std::string encoded(bufferPtr->data, bufferPtr->length);
    BIO_free_all(b64);
    return encoded;
}

inline void write_minimal_encrypted_json(const std::string& path,
                                         const std::vector<uint8_t>& ciphertext,
                                         const std::vector<uint8_t>& iv,
                                         const std::vector<uint8_t>& tag,
                                         const std::vector<uint8_t>& encrypted_key) {
    json j;
    j["d"] = base64_encode(ciphertext);      
    j["k"] = base64_encode(encrypted_key);    
    j["n"] = base64_encode(iv);             
    j["t"] = base64_encode(tag);           

    std::ofstream out(path, std::ios::trunc);
    if (!out) throw std::runtime_error("Cannot write encrypted payload file.");
    out << j.dump(0); 
}