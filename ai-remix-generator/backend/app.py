# app.py — AI Remix Generator Backend
# Fix: use --flac flag to bypass torchcodec completely
# © 2025 Vashisht

import os
import re
import subprocess
import sys 
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from pydub import AudioSegment
from pydub.effects import normalize

# ── App Setup ──────────────────────────────────────────
app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER    = 'uploads'
PROCESSED_FOLDER = 'processed'
SEPARATED_FOLDER = 'separated'

os.makedirs(UPLOAD_FOLDER,    exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)
os.makedirs(SEPARATED_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {'mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'}


# ── Helpers ────────────────────────────────────────────
def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_extension(filename):
    return filename.rsplit('.', 1)[1].lower()

def sanitize_filename(filename):
    """
    Remove spaces and special characters from filename.
    'Suno Na Song 320.mp3' → 'Suno_Na_Song_320.mp3'
    """
    name, ext = os.path.splitext(filename)
    name = name.replace(' ', '_')
    name = re.sub(r'[^\w\-]', '', name)
    if not name:
        name = 'audio_file'
    return f"{name}{ext}"


# ══════════════════════════════════════════════════════
#  AUDIO EFFECTS
# ══════════════════════════════════════════════════════

def apply_slowdown(audio, factor=0.80):
    original_rate = audio.frame_rate
    new_rate      = int(original_rate * factor)
    slowed = audio._spawn(
        audio.raw_data,
        overrides={"frame_rate": new_rate}
    )
    return slowed.set_frame_rate(original_rate)


def apply_bass_boost(audio, boost_db=8):
    bass_part    = audio.low_pass_filter(200)
    bass_boosted = bass_part + boost_db
    result       = audio.overlay(bass_boosted)
    return normalize(result)


def apply_reverb(audio, decay=0.4, delays_ms=None):
    if delays_ms is None:
        delays_ms = [30, 60, 100, 150]
    result = audio
    for i, delay_ms in enumerate(delays_ms):
        volume_reduction = (i + 1) * (decay * 10)
        echo             = audio - volume_reduction
        silence          = AudioSegment.silent(duration=delay_ms)
        delayed_echo     = silence + echo
        result           = result.overlay(delayed_echo, position=0)
    return normalize(result)


def apply_pitch_up(audio, semitones=3):
    original_rate = audio.frame_rate
    new_rate      = int(original_rate * (2 ** (semitones / 12.0)))
    pitched = audio._spawn(
        audio.raw_data,
        overrides={"frame_rate": new_rate}
    )
    return pitched.set_frame_rate(original_rate)


def apply_pitch_down(audio, semitones=3):
    original_rate = audio.frame_rate
    new_rate      = int(original_rate / (2 ** (semitones / 12.0)))
    pitched = audio._spawn(
        audio.raw_data,
        overrides={"frame_rate": new_rate}
    )
    return pitched.set_frame_rate(original_rate)


def apply_echo(audio, delay_ms=380, decay_db=6, repeats=4):
    result = audio
    for i in range(1, repeats + 1):
        volume_cut   = i * decay_db
        echo_copy    = audio - volume_cut
        silence      = AudioSegment.silent(duration=delay_ms * i)
        delayed_echo = silence + echo_copy
        result       = result.overlay(delayed_echo, position=0)
    return normalize(result)


def apply_lofi(audio):
    lofi     = audio.set_channels(1)
    lofi     = lofi.set_frame_rate(22050)
    lofi     = lofi.low_pass_filter(3500)
    mid_bass = lofi.low_pass_filter(400)
    lofi     = lofi.overlay(mid_bass + 3)
    lofi     = lofi.set_frame_rate(44100)
    lofi     = lofi - 2
    return normalize(lofi)


def apply_bollywood(audio):
    print("   [Bollywood] Step 1/4 — Slight slowdown...")
    result = apply_slowdown(audio, factor=0.93)
    print("   [Bollywood] Step 2/4 — Bass boost...")
    result = apply_bass_boost(result, boost_db=6)
    print("   [Bollywood] Step 3/4 — Studio reverb...")
    result = apply_reverb(
        result, decay=0.35,
        delays_ms=[20, 45, 80, 120, 180]
    )
    print("   [Bollywood] Step 4/4 — Pitch warmth...")
    result = apply_pitch_down(result, semitones=1)
    return normalize(result)


# ══════════════════════════════════════════════════════
#  AI SEPARATION — DEMUCS
#  KEY FIX: use --flac flag → bypasses torchcodec entirely
#  pydub can read .flac files natively via ffmpeg
# ══════════════════════════════════════════════════════

def run_demucs(input_path, output_dir):
    """
    Run Demucs via our wrapper script that patches torchaudio.save.
    
    Instead of calling:
        python -m demucs ...
    
    We call:
        python demucs_wrapper.py ...
    
    The wrapper patches torchaudio.save to use soundfile
    BEFORE demucs loads — so torchcodec is never touched.
    """
    print(f"\n   [Demucs] Input  : {input_path}")
    print(f"   [Demucs] Output : {output_dir}")
    print(f"   [Demucs] Method : patched wrapper (no torchcodec)")

    # Get absolute path to the wrapper script
    # __file__ = path to this app.py file
    # We put demucs_wrapper.py in the same folder
    wrapper_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "demucs_wrapper.py"
    )

    if not os.path.exists(wrapper_path):
        raise Exception(
            f"demucs_wrapper.py not found at: {wrapper_path}\n"
            "Please create the wrapper script first."
        )

    command = [
        sys.executable,         # use the SAME python that runs flask
                                 # (important — uses the venv python)
        wrapper_path,            # our patched wrapper
        "--two-stems", "vocals",
        "--device",    "cpu",
        "-j",          "1",
        "-o",          output_dir,
        "-n",          "htdemucs",
        input_path
    ]

    print(f"   [Demucs] Command: python demucs_wrapper.py ...")
    print(f"   [Demucs] Running (4-5 min on CPU)...")

    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )

    output_lines = []
    for line in process.stdout:
        clean = line.rstrip()
        if clean:
            print(f"   [Demucs] {clean}")
            output_lines.append(clean)

    process.wait()

    print(f"   [Demucs] Return code: {process.returncode}")

    if process.returncode != 0:
        last = '\n'.join(output_lines[-6:])
        raise Exception(
            f"Demucs failed (code {process.returncode}).\n{last}"
        )

    print("   [Demucs] ✅ Separation complete!")
    return True

def find_demucs_output(output_dir):
    """
    Find the FLAC files Demucs created.

    Demucs output structure:
    output_dir/
    └── htdemucs/
        └── song_name/
            ├── vocals.flac       ← we look for these
            └── no_vocals.flac
    """
    model_folder = os.path.join(output_dir, "htdemucs")

    print(f"   [Find] Searching in: {model_folder}")

    if not os.path.exists(model_folder):
        contents = os.listdir(output_dir) if os.path.exists(output_dir) else []
        raise Exception(
            f"Demucs output folder missing.\n"
            f"Contents of {output_dir}: {contents}"
        )

    # Get all subdirectories (one per song)
    subdirs = [
        d for d in os.listdir(model_folder)
        if os.path.isdir(os.path.join(model_folder, d))
    ]

    if not subdirs:
        raise Exception(f"No output subfolder found in {model_folder}")

    song_folder = os.path.join(model_folder, subdirs[0])
    files       = os.listdir(song_folder)

    print(f"   [Find] Song folder : {song_folder}")
    print(f"   [Find] Files found : {files}")

    return song_folder, files


def convert_to_mp3(input_file_path, output_mp3_path, fmt):
    """
    Convert any audio file (flac/wav) to MP3 using pydub.
    pydub uses ffmpeg under the hood — no torchcodec needed!
    """
    print(f"   [Convert] {os.path.basename(input_file_path)} → "
          f"{os.path.basename(output_mp3_path)}")

    audio = AudioSegment.from_file(input_file_path, format=fmt)
    audio.export(output_mp3_path, format="mp3", bitrate="192k")
    print(f"   [Convert] ✅ Done")


# ══════════════════════════════════════════════════════
#  ROUTES
# ══════════════════════════════════════════════════════

@app.route('/hello')
def hello():
    return jsonify({"message": "Backend is working! 🎵"})


# ── Upload ─────────────────────────────────────────────
@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file was sent"}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Invalid file type."}), 400

    original_name = file.filename
    safe_filename = sanitize_filename(file.filename)
    save_path     = os.path.join(UPLOAD_FOLDER, safe_filename)
    file.save(save_path)

    print(f"✅ Uploaded: '{original_name}' → '{safe_filename}'")

    return jsonify({
        "message":  f"'{original_name}' uploaded successfully!",
        "filename": safe_filename
    }), 200


# ── Process Effects ────────────────────────────────────
@app.route('/process', methods=['POST'])
def process_audio():
    data     = request.get_json()
    filename = data.get('filename')
    effect   = data.get('effect')

    if not filename or not effect:
        return jsonify({"error": "Missing filename or effect"}), 400

    input_path = os.path.join(UPLOAD_FOLDER, filename)

    if not os.path.exists(input_path):
        return jsonify({"error": f"File '{filename}' not found."}), 404

    print(f"\n🎛️  '{filename}' → effect: '{effect}'")

    try:
        ext   = get_extension(filename)
        audio = AudioSegment.from_file(input_path, format=ext)

        print(f"   Duration : {len(audio)/1000:.1f}s")
        print(f"   Channels : {audio.channels}")
        print(f"   Rate     : {audio.frame_rate} Hz")

        effect_map = {
            'slowdown':  lambda a: apply_slowdown(a),
            'bass':      lambda a: apply_bass_boost(a),
            'reverb':    lambda a: apply_reverb(a),
            'pitchup':   lambda a: apply_pitch_up(a),
            'pitchdown': lambda a: apply_pitch_down(a),
            'echo':      lambda a: apply_echo(a),
            'lofi':      lambda a: apply_lofi(a),
            'bollywood': lambda a: apply_bollywood(a),
        }

        if effect not in effect_map:
            return jsonify({"error": f"Unknown effect '{effect}'"}), 400

        processed       = effect_map[effect](audio)
        output_filename = f"{effect}_{filename.rsplit('.', 1)[0]}.mp3"
        output_path     = os.path.join(PROCESSED_FOLDER, output_filename)
        processed.export(output_path, format="mp3", bitrate="192k")

        print(f"✅ Saved: {output_filename}")

        return send_file(
            output_path,
            mimetype='audio/mpeg',
            as_attachment=True,
            download_name=output_filename
        )

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({"error": str(e)}), 500


# ── AI Separate ────────────────────────────────────────
@app.route('/separate', methods=['POST'])
def separate_audio():
    data     = request.get_json()
    filename = data.get('filename')

    if not filename:
        return jsonify({"error": "Missing filename"}), 400

    input_path = os.path.join(UPLOAD_FOLDER, filename)

    if not os.path.exists(input_path):
        return jsonify({"error": f"File '{filename}' not found."}), 404

    print(f"\n🤖 AI Separation → '{filename}'")

    try:
        filename_no_ext = filename.rsplit('.', 1)[0]
        output_dir      = os.path.join(SEPARATED_FOLDER, filename_no_ext)
        os.makedirs(output_dir, exist_ok=True)

        # ── Run Demucs (outputs .flac files) ──
        run_demucs(input_path, output_dir)

        # ── Find the .flac output files ──
        song_folder, files = find_demucs_output(output_dir)

        # ── Convert each .flac → .mp3 ──
        result_files = {}

        for audio_file in files:
            # Determine format
            if audio_file.endswith('.flac'):
                fmt       = 'flac'
                stem_name = audio_file.replace('.flac', '')
            elif audio_file.endswith('.wav'):
                fmt       = 'wav'
                stem_name = audio_file.replace('.wav', '')
            else:
                # Skip non-audio files
                continue

            # stem_name is "vocals" or "no_vocals"
            mp3_name = f"{stem_name}_{filename_no_ext}.mp3"
            mp3_path = os.path.join(PROCESSED_FOLDER, mp3_name)

            convert_to_mp3(
                os.path.join(song_folder, audio_file),
                mp3_path,
                fmt
            )

            result_files[stem_name] = mp3_name

        if not result_files:
            raise Exception(
                "No audio files found in Demucs output. "
                f"Files in folder: {files}"
            )

        print(f"\n✅ Separation complete!")
        print(f"   Tracks: {list(result_files.keys())}")

        return jsonify({
            "message": "Separation complete!",
            "files":   result_files
        }), 200

    except Exception as e:
        print(f"❌ Separation error: {str(e)}")
        return jsonify({"error": str(e)}), 500


# ── Download Separated Track ───────────────────────────
@app.route('/download/<filename>', methods=['GET'])
def download_track(filename):
    """
    Serve a processed file by name.
    Frontend calls this to get separated stems for preview.
    """
    file_path = os.path.join(PROCESSED_FOLDER, filename)

    if not os.path.exists(file_path):
        # List what IS available to help debug
        available = os.listdir(PROCESSED_FOLDER)
        print(f"   [Download] '{filename}' not found.")
        print(f"   [Download] Available: {available}")
        return jsonify({
            "error":     f"File not found: {filename}",
            "available": available
        }), 404

    print(f"   [Download] Serving: {filename}")

    return send_file(
        file_path,
        mimetype='audio/mpeg',
        as_attachment=True,
        download_name=filename
    )


# ── Start ──────────────────────────────────────────────
if __name__ == '__main__':
    app.run(debug=True, port=5000)