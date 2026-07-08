from flask import Blueprint

api_bp = Blueprint('api_bp', __name__)

from . import predict_api
# from .auth_api import auth_bp

# Register auth blueprint
# api_bp.register_blueprint(auth_bp, url_prefix='/auth')
