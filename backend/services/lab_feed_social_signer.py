"""
LabFeedSocial registrar signer.

Produces the "this postId belongs to this author" attestation that
contracts/contracts/LabFeedSocial.sol's _ensureRegistered() checks on a
post's first paid Like or Comment (see that function's comment for why the
contract needs this instead of trusting a caller-supplied author directly).

The digest computed here must match the contract exactly:

    keccak256(abi.encodePacked(postId, author, contractAddress, chainId))

...then hashed again with the standard personal-sign prefix
("\\x19Ethereum Signed Message:\\n32", applied by encode_defunct below) and
signed with the registrar's private key.

This key is intentionally separate from every other key this backend or the
contracts touch (deployer, admin/owner, treasury). It can only ever be used
to attest a postId/author pair — it has no spending power and no admin
rights on the contract, so if it's ever compromised the blast radius is
"someone can mis-register a not-yet-registered post," not "someone can
touch funds or contract config." Generate it in a wallet, keep only the
private key here (env var), and give the deploy workflow the public address.
"""
import os

from eth_account import Account
from eth_account.messages import encode_defunct
from eth_utils import keccak

REGISTRAR_PRIVATE_KEY = os.environ.get("LABFEED_REGISTRAR_PRIVATE_KEY", "")
LABFEED_SOCIAL_CONTRACT_ADDRESS = os.environ.get("LABFEED_SOCIAL_CONTRACT_ADDRESS", "")
LABFEED_SOCIAL_CHAIN_ID = int(os.environ.get("LABFEED_SOCIAL_CHAIN_ID", "6281971"))  # DogeOS Chikyu testnet

_registrar_account = Account.from_key(REGISTRAR_PRIVATE_KEY) if REGISTRAR_PRIVATE_KEY else None


def is_configured() -> bool:
    return bool(_registrar_account and LABFEED_SOCIAL_CONTRACT_ADDRESS)


def registrar_address() -> str:
    """Public address of the configured registrar key, for the /status
    diagnostic endpoint - never returns or logs the key itself."""
    return _registrar_account.address if _registrar_account else ""


def _address_to_bytes(address: str) -> bytes:
    return bytes.fromhex(address[2:].rjust(40, "0")) if address.startswith("0x") else bytes.fromhex(address.rjust(40, "0"))


def compute_post_id(author_address: str, backend_post_id: str) -> bytes:
    """postId = keccak256(author ++ backendPostId). backend_post_id is
    lab_notes.id (a uuid4 string), encoded as its own UTF-8 bytes - this
    hash is only ever computed here (the contract treats postId as opaque
    and never re-derives it), so there's no cross-language format to keep
    in sync with anything else."""
    return keccak(_address_to_bytes(author_address) + backend_post_id.encode("utf-8"))


def sign_registration(post_id: bytes, author_address: str) -> str:
    if not is_configured():
        raise RuntimeError("LabFeedSocial registrar signer is not configured")
    digest = keccak(
        post_id
        + _address_to_bytes(author_address)
        + _address_to_bytes(LABFEED_SOCIAL_CONTRACT_ADDRESS)
        + LABFEED_SOCIAL_CHAIN_ID.to_bytes(32, "big")
    )
    signed = Account.sign_message(encode_defunct(digest), private_key=REGISTRAR_PRIVATE_KEY)
    return "0x" + signed.signature.hex()
