#!/usr/bin/env python
# demucs_wrapper.py
# Patches torchaudio.save to use soundfile instead of torchcodec
# This bypasses the libnppicc.so.13 / torchcodec issue completely
# © 2025 Vashisht

import sys
import os

# ══════════════════════════════════════════════════════
#  PATCH torchaudio.save BEFORE importing demucs
#  This must happen BEFORE any demucs import
# ══════════════════════════════════════════════════════

def patched_save(uri, src, sample_rate, **kwargs):
    """
    Replacement for torchaudio.save() that uses soundfile.
    
    Why soundfile?
    - soundfile uses libsndfile (a C library)
    - Does NOT need torchcodec or CUDA
    - Supports WAV and FLAC formats perfectly
    - Already installed as a dependency of librosa
    
    Parameters:
    - uri         : output file path (string)
    - src         : audio tensor (torch.Tensor)
    - sample_rate : sample rate in Hz (e.g. 44100)
    """
    import soundfile as sf
    import numpy as np

    # Convert PyTorch tensor → numpy array
    # tensor.numpy() gives us a numpy array
    # The shape is (channels, samples) — soundfile needs (samples, channels)
    audio_numpy = src.numpy()

    # Transpose: (channels, samples) → (samples, channels)
    # If mono (1 channel), squeeze to 1D array
    if audio_numpy.shape[0] == 1:
        audio_numpy = audio_numpy.squeeze(0)  # (samples,)
    else:
        audio_numpy = audio_numpy.T           # (samples, channels)

    # Determine format from file extension
    uri_str = str(uri)
    if uri_str.endswith('.flac'):
        fmt = 'FLAC'
        subtype = 'PCM_16'
    else:
        # Default to WAV
        fmt = 'WAV'
        subtype = 'PCM_16'

    print(f"   [Patch] Saving via soundfile: {os.path.basename(uri_str)}")
    sf.write(uri_str, audio_numpy, sample_rate, format=fmt, subtype=subtype)
    print(f"   [Patch] ✅ Saved successfully!")


# Apply the patch — replace torchaudio.save with our version
import torchaudio
torchaudio.save = patched_save
print("[Patch] ✅ torchaudio.save patched to use soundfile")

# ══════════════════════════════════════════════════════
#  NOW run demucs with the patched torchaudio
# ══════════════════════════════════════════════════════

# sys.argv[1:] contains all the arguments passed to this script
# We pass them straight to demucs
# Example: python demucs_wrapper.py --two-stems vocals -o out song.mp3
# → demucs receives:          --two-stems vocals -o out song.mp3

print(f"[Wrapper] Starting demucs with args: {sys.argv[1:]}")

from demucs.__main__ import main
sys.exit(main())