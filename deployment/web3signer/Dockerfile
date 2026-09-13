FROM consensys/web3signer:26.4.2

COPY --chown=web3signer:web3signer deployment/web3signer/start-web3signer.sh /opt/tessera/start-web3signer.sh
RUN chmod 0550 /opt/tessera/start-web3signer.sh

ENTRYPOINT ["/bin/sh", "/opt/tessera/start-web3signer.sh"]
