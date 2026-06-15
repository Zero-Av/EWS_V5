from huggingface_hub import hf_hub_download

hf_hub_download(
    repo_id="cardiffnlp/twitter-roberta-base-sentiment-latest",
    filename="pytorch_model.bin",
    resume_download=False,
    force_download=True
)