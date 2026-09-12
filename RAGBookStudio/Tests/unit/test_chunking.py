"""Unit tests for chunking strategies."""

from Core.chunking.strategies import (
    FixedSizeChunker,
    ParagraphChunker,
    SentenceChunker,
    get_chunker,
)
from Interfaces.chunking import ChunkingConfig, ChunkStrategy


SAMPLE = """
Chapter 1 Introduction

This is the first paragraph. It contains several sentences. Here is another one.

This is the second paragraph. It talks about something else entirely.

Chapter 2 Methods

The methods section describes how the experiment was conducted. Multiple steps were involved.
"""


def test_fixed_chunker():
    chunker = FixedSizeChunker()
    config = ChunkingConfig(strategy=ChunkStrategy.FIXED, chunk_size=100, chunk_overlap=20, min_chunk_size=10)
    chunks = chunker.chunk(SAMPLE, config)
    assert len(chunks) > 0
    for c in chunks:
        assert c.id
        assert c.text
        assert c.strategy == "fixed"


def test_paragraph_chunker():
    chunker = ParagraphChunker()
    config = ChunkingConfig(strategy=ChunkStrategy.PARAGRAPH, chunk_size=500, min_chunk_size=10)
    chunks = chunker.chunk(SAMPLE, config)
    assert len(chunks) >= 1


def test_sentence_chunker():
    chunker = SentenceChunker()
    config = ChunkingConfig(strategy=ChunkStrategy.SENTENCE, chunk_size=200, min_chunk_size=5)
    chunks = chunker.chunk(SAMPLE, config)
    assert len(chunks) >= 1


def test_get_chunker():
    assert get_chunker("fixed").strategy == ChunkStrategy.FIXED
    assert get_chunker(ChunkStrategy.PARAGRAPH).strategy == ChunkStrategy.PARAGRAPH


def test_chapter_chunker():
    chunker = get_chunker("chapter")
    config = ChunkingConfig(strategy=ChunkStrategy.CHAPTER, chunk_size=500, min_chunk_size=10, max_chunk_size=2000)
    chunks = chunker.chunk(SAMPLE, config)
    assert len(chunks) >= 1
