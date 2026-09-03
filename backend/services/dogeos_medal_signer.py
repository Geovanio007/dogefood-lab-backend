"""
HeistMedal registrar signer.

Produces the "this wallet is eligible for a heist medal" attestation that
contracts/contracts/HeistMedal.sol's claimMedal() checks. Same pattern as
services/lab_feed_social_signer.py (see that file's docstring for the full
reasoning on why this uses a dedicated key) - the only difference is what
gets hashed.

The digest computed here must match the contract exactly:

    keccak256(abi.encodePacked(claimer, CAMPAIGN_ID, contractAddress, chainId))

where CAMPAIGN_ID = keccak256("DOGEOS_GRAND_HEIST_2026_MEDAL") (a Solidity
string-literal keccak256 call hashes the raw UTF-8 bytes with no length
prefix - see CAMPAIGN_ID_BYTES below for the Python equivalent), then hashed
again with the standard personal-sign prefix and signed with the registrar's
private key.

This digest has no expiry or nonce - it's the same signature every time for
a given wallet, which is intentional: eligibility (did they create a Lab
Launcher token) can be re-checked fresh on every request, and the contract's
own hasClaimed mapping is what actually prevents a signature being used
twice. That also means this signer never needs to track "did I already
issue this" - sign_claim() is a pure function of (wallet, contract, chain).

Use a NEW dedicated key here - do not reuse LABFEED_REGISTRAR_PRIVATE_KEY or
any admin/deployer/treasury key. Generate it in a wallet, keep only the
private key here (env var), and give the deploy workflow the public address
via HEIST_MEDAL_REGISTRAR_SIGNER_ADDRESS.
"""
import os

from eth_account import Account
from eth_account.messages import encode_defunct
from eth_utils import keccak

REGISTRAR_PRIVATE_KEY = os.environ.get("HEIST_MEDAL_REGISTRAR_PRIVATE_KEY", "")
HEIST_MEDAL_CONTRACT_ADDRESS = os.environ.get("HEIST_MEDAL_CONTRACT_ADDRESS", "")
HEIST_MEDAL_CHAIN_ID = int(os.environ.get("HEIST_MEDAL_CHAIN_ID", "6281971"))  # DogeOS Chikyu testnet

CAMPAIGN_ID_BYTES = keccak(b"DOGEOS_GRAND_HEIST_2026_MEDAL")

_registrar_account = Account.from_key(REGISTRAR_PRIVATE_KEY) if REGISTRAR_PRIVATE_KEY else None


def is_configured() -> bool:
    return bool(_registrar_account and HEIST_MEDAL_CONTRACT_ADDRESS)


def registrar_address() -> str:
    """Public address of the configured registrar key, for the /status
    diagnostic endpoint - never returns or logs the key itself."""
    return _registrar_account.address if _registrar_account else ""


def _address_to_bytes(address: str) -> bytes:
    return bytes.fromhex(address[2:].rjust(40, "0")) if address.startswith("0x") else bytes.fromhex(address.rjust(40, "0"))


def sign_claim(wallet_address: str) -> str:
    if not is_configured():
        raise RuntimeError("HeistMedal registrar signer is not configured")
    digest = keccak(
        _address_to_bytes(wallet_address)
        + CAMPAIGN_ID_BYTES
        + _address_to_bytes(HEIST_MEDAL_CONTRACT_ADDRESS)
        + HEIST_MEDAL_CHAIN_ID.to_bytes(32, "big")
    )
    signed = Account.sign_message(encode_defunct(digest), private_key=REGISTRAR_PRIVATE_KEY)
    return "0x" + signed.signature.hex()
