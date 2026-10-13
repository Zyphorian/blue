import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { asset } from "../utils/assetUrl.js";

// Track list
const musicTracks = [
  asset("/music/Astrud_Gilberto.mp3"),
  asset("/music/Cyberpunk_Edgerunners.mp3"),
  asset("/music/Funk_Da_Montanha.mp3"),
  asset("/music/Gata_Only.mp3"),
  asset("/music/Got_Your_Number.mp3"),
  asset("/music/Peter_Griffin_Viva_la_Vida.mp3"),
  asset("/music/WARNING.mp3"),
  asset("/music/COM_MEDO.mp3"),
  asset("/music/CoolerThanMe.mp3"),
  asset("/music/De_Beleza.mp3"),
  asset("/music/GrandTheftAutoIVThemeSong.mp3"),
  asset("/music/MONTAGEM.mp3"),
  // Spelling matches the committed file exactly ("Inthe", lower-case t). GitHub
  // Pages runs on Linux, where names are case-sensitive, so this must not be
  // "corrected" unless the file is renamed in the same commit.
  asset("/music/OnlyGirlIntheWorld.mp3"),
];

const initialTrackName = "Got_Your_Number.mp3";
const defaultIndex = musicTracks.findIndex(track => track.includes(initialTrackName));
const safeIndex = defaultIndex !== -1 ? defaultIndex : 0;

export const MusicContext = createContext();

// localStorage can still hold values written by older versions of this file - for
// example a JSON-quoted volume like "\"0.5\"" or an out-of-range number. Reading
// those blindly produced NaN, and assigning NaN (or a value outside 0-1) to
// audio.volume throws, which crashed the whole app into a blank white page with
// no header and no footer. Every stored value is validated below instead.
const readStoredVolume = () => {
  const saved = localStorage.getItem('musicVolume');
  if (saved === null) return 0.5;
  const parsed = parseFloat(saved);
  if (!Number.isFinite(parsed)) return 0.5;
  return Math.min(1, Math.max(0, parsed));
};

const readStoredTrackIndex = () => {
  const saved = localStorage.getItem('currentTrackIndex');
  if (saved === null) return safeIndex;
  const parsed = parseInt(saved, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed >= musicTracks.length) {
    return safeIndex;
  }
  return parsed;
};

const readStoredIsPlaying = () => {
  const saved = localStorage.getItem('isPlaying');
  if (saved === null) return false;
  try {
    return JSON.parse(saved) === true;
  } catch {
    // Not JSON at all - treat the raw string as the value.
    return saved === 'true';
  }
};

export const MusicProvider = ({ children }) => {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(readStoredTrackIndex);

  const [isPlaying, setIsPlaying] = useState(readStoredIsPlaying);

  const [volume, setVolume] = useState(readStoredVolume);

  const audioRef = useRef(new Audio(musicTracks[safeIndex]));

  // This useEffect now handles both loading the track and starting playback automatically
  // when a track ends, but only if the player is currently playing.
  useEffect(() => {
    const audio = audioRef.current;
    audio.src = musicTracks[currentTrackIndex];
    audio.load();

    const handleEnded = () => {
      setCurrentTrackIndex(prev => (prev + 1) % musicTracks.length);
      // The audio playback logic is now handled by the isPlaying state effect
    };

    audio.addEventListener('ended', handleEnded);

    // This will automatically play the next track after the state update
    if (isPlaying) {
      audio.play().catch(err => {
        console.warn("Autoplay failed:", err);
        setIsPlaying(false);
      });
    }

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
    };
  }, [currentTrackIndex, isPlaying]); // Added isPlaying to the dependency array

  // Update volume
  useEffect(() => {
    const audio = audioRef.current;
    // Never hand an invalid value to the audio element: it throws, and a throw in
    // an effect takes the entire app down to a white screen.
    const safeVolume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.5;
    audio.volume = safeVolume;
    localStorage.setItem('musicVolume', String(safeVolume));
  }, [volume]);

  // Save current track index
  useEffect(() => {
    localStorage.setItem('currentTrackIndex', currentTrackIndex.toString());
  }, [currentTrackIndex]);

  const togglePlayPause = () => setIsPlaying(prev => !prev);

  const nextMusic = () => {
    setCurrentTrackIndex(prev => {
      const nextIndex = (prev + 1) % musicTracks.length;
      return nextIndex;
    });
    setIsPlaying(true);
  };

  const previousMusic = () => {
    setCurrentTrackIndex(prev => {
      const prevIndex = (prev - 1 + musicTracks.length) % musicTracks.length;
      return prevIndex;
    });
    setIsPlaying(true);
  };

  const stopMusic = () => {
    const audio = audioRef.current;
    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
  };

  const handleVolumeChange = (newVolume) => {
    const parsed = parseFloat(newVolume);
    // Ignore anything that is not a usable number so the slider can never wedge
    // the player into an invalid state.
    setVolume(Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 0.5);
  };

  const musicControls = {
    isPlaying,
    volume,
    togglePlayPause,
    nextMusic,
    previousMusic,
    stopMusic,
    handleVolumeChange,
    currentTrackName: musicTracks[currentTrackIndex],
  };

  return (
    <MusicContext.Provider value={musicControls}>
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = () => useContext(MusicContext);

function MusicPlayer() {
  return null;
}

export default MusicPlayer;